const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const assemblyKey = Deno.env.get('ASSEMBLYAI_API_KEY')!

const DEBRIEF_PROMPT_V1 = `
You are an expert field intelligence analyst for The/Nudge Foundation,
an NGO working on rural livelihoods in Karnataka, India.

Analyze the field visit notes below and extract structured intelligence.

CRITICAL RULES:
1. Only extract information EXPLICITLY present in the notes/transcript.
2. Do NOT infer, assume, or add context not provided by the officer.
3. If a field has no relevant content, return an empty array [].
4. Return ONLY valid JSON. No preamble, no explanation, no markdown fences.

VISIT DETAILS:
<structured_fields>
Location: {{location_name}}
Date: {{visit_date}}
Program Area: {{program_area}}
Stakeholders Met: {{stakeholders}}
Duration: {{duration_mins}} minutes
</structured_fields>

<officer_notes>
{{text_notes}}
</officer_notes>

<voice_transcript>
{{transcript}}
</voice_transcript>

<location_history>
{{last_3_visits_json}}
</location_history>

Return this exact JSON structure and nothing else:
{
  "key_findings":        ["string"],
  "blockers":            ["string"],
  "community_sentiment": "Positive",
  "follow_ups":          ["string"],
  "nudge_flag":          "Routine",
  "recurring_issues":    ["string"],
  "summary":             "2-3 sentence summary of the visit"
}

community_sentiment must be exactly one of: Positive, Mixed, Negative
nudge_flag must be exactly one of: Routine, Needs Attention, Escalate
`

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  })
  return res.json()
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const res = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'authorization': assemblyKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, language_code: 'en', punctuate: true }),
  })
  const { id } = await res.json()

  const start = Date.now()
  while (Date.now() - start < 60_000) {
    await new Promise(r => setTimeout(r, 3000))
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'authorization': assemblyKey },
    })
    const result = await poll.json()
    if (result.status === 'completed') return result.text
    if (result.status === 'error') break
  }
  return ''
}

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: 'You are a JSON-only response bot. You must return only valid JSON with no explanation, no markdown, no code fences.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

Deno.serve(async (req) => {
  let visitId = ''
  try {
    const payload = await req.json()
    visitId = payload.record?.id

    if (!visitId) return new Response('No visit ID', { status: 400 })

    // 1. Fetch visit
    const visits = await supabaseFetch(
      `visits?id=eq.${visitId}&select=*,locations(name)&limit=1`
    )
    const visit = visits[0]
    if (!visit) return new Response('Visit not found', { status: 404 })

    // 2. Transcribe voice memo if present
    let transcript = ''
    if (visit.voice_memo_path) {
      await supabaseFetch(`visits?id=eq.${visitId}`, {
        method: 'PATCH',
        body: JSON.stringify({ transcription_status: 'pending' }),
      })

      const signedRes = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/voice-memos/${visit.voice_memo_path}`,
        {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: 900 }),
        }
      )
      const { signedURL } = await signedRes.json()

      if (signedURL) {
        transcript = await transcribeAudio(`${supabaseUrl}/storage/v1${signedURL}`)
        await supabaseFetch(`visits?id=eq.${visitId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            transcript,
            transcription_status: transcript ? 'done' : 'failed',
          }),
        })
      }
    }

    // 3. Fetch last 3 visits to same location
    const history = await supabaseFetch(
      `visits?location_id=eq.${visit.location_id}&id=neq.${visitId}&select=visit_date,debriefs(summary,blockers,nudge_flag)&order=visit_date.desc&limit=3`
    )

    // 4. Build prompt
    const prompt = DEBRIEF_PROMPT_V1
      .replace('{{location_name}}',      visit.locations?.name || 'Unknown')
      .replace('{{visit_date}}',         visit.visit_date)
      .replace('{{program_area}}',       visit.program_area)
      .replace('{{stakeholders}}',       (visit.stakeholders || []).join(', ') || 'None specified')
      .replace('{{duration_mins}}',      String(visit.duration_mins || 'Not specified'))
      .replace('{{text_notes}}',         visit.text_notes || '(none)')
      .replace('{{transcript}}',         transcript || '(no voice memo)')
      .replace('{{last_3_visits_json}}', JSON.stringify(history || []))

    // 5. Call Gemini and validate response
    let raw = await callGroq(prompt)
    raw = raw.replace(/```json|```/g, '').trim()

    let debrief = null
    try {
      debrief = JSON.parse(raw)
      if (debrief.error || !debrief.summary || !debrief.nudge_flag) {
        throw new Error('Invalid debrief shape')
      }
    } catch {
      // Retry once
      raw = await callGroq(prompt)
      raw = raw.replace(/```json|```/g, '').trim()
      try {
        debrief = JSON.parse(raw)
        if (debrief.error || !debrief.summary || !debrief.nudge_flag) {
          throw new Error('Invalid debrief shape on retry')
        }
      } catch {
        await supabaseFetch(`visits?id=eq.${visitId}`, {
          method: 'PATCH',
          body: JSON.stringify({ debrief_status: 'failed', debrief_raw: raw }),
        })
        return new Response(`parse failed: ${raw.substring(0, 200)}`, { status: 200 })
      }
    }

    // 6. Build clean debrief — only fields that exist in DB
    const cleanDebrief = {
      visit_id:            visitId,
      key_findings:        debrief.key_findings        || [],
      blockers:            debrief.blockers             || [],
      community_sentiment: debrief.community_sentiment  || 'Mixed',
      follow_ups:          debrief.follow_ups           || [],
      nudge_flag:          debrief.nudge_flag           || 'Routine',
      recurring_issues:    debrief.recurring_issues     || [],
      summary:             debrief.summary              || '',
    }

    // 7. Save debrief
    const debriefInsertRes = await fetch(`${supabaseUrl}/rest/v1/debriefs`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(cleanDebrief),
    })

    const debriefResult = await debriefInsertRes.json()

    if (!debriefInsertRes.ok) {
      await supabaseFetch(`visits?id=eq.${visitId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          debrief_status: 'failed',
          debrief_raw: JSON.stringify(debriefResult),
        }),
      })
      return new Response(`Debrief insert failed: ${JSON.stringify(debriefResult)}`, { status: 200 })
    }

    // 8. Update visit status to done
    await supabaseFetch(`visits?id=eq.${visitId}`, {
      method: 'PATCH',
      body: JSON.stringify({ debrief_status: 'done' }),
    })

    return new Response('ok', { status: 200 })

  } catch (err) {
    if (visitId) {
      await supabaseFetch(`visits?id=eq.${visitId}`, {
        method: 'PATCH',
        body: JSON.stringify({ debrief_status: 'failed', debrief_raw: String(err) }),
      })
    }
    return new Response(`Error: ${String(err)}`, { status: 500 })
  }
})