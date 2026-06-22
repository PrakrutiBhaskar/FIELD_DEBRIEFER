# Doc 04 — AI/ML Pipeline Design Document

Two AI operations in this system:
- **Debrief Generation** — per visit, triggered async via DB webhook
- **Pattern Report** — per manager request, streamed inline

Both use `Groq-sonnet-4-6`. Voice transcription uses AssemblyAI synchronous endpoint.

---

## Async Debrief Pipeline — Step by Step

| Step | Service | Action | Failure Handling |
|---|---|---|---|
| 1 | Next.js API | Insert visit row, return 201 immediately | If DB insert fails: 500 to client, nothing else runs |
| 2 | Supabase DB Webhook | Fires on INSERT to `visits` table | If webhook fails: cron picks up pending rows in 15 min |
| 3 | Edge Function | Receives `visit_id`, fetches full visit row | If fetch fails: log + exit, cron retries |
| 4 | AssemblyAI | POST audio, poll for transcript (sync mode) | If fails: set `transcription_status='failed'`, continue without transcript |
| 5 | Groq API | POST debrief prompt, receive JSON | If fails or invalid JSON: retry once with stricter prompt |
| 6 | Zod | Validate Groq output against `debriefOutputSchema` | If retry also fails: save `debrief_raw`, set `debrief_status='failed'` |
| 7 | Supabase DB | INSERT into debriefs, UPDATE `visits.debrief_status='done'` | If DB write fails: log, cron retries |
| 8 | Realtime | Client receives status change, renders debrief card | If client offline: next page load fetches status |

---

## Edge Function — `process-debrief/index.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { debriefOutputSchema } from '../../lib/schemas.ts'
import { DEBRIEF_PROMPT_V1 } from '../../lib/prompts.ts'

Deno.serve(async (req) => {
  const { record } = await req.json()  // from DB webhook
  const visitId = record.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Fetch full visit
  const { data: visit } = await supabase
    .from('visits')
    .select('*, locations(name), profiles(full_name)')
    .eq('id', visitId)
    .single()

  // 2. Transcribe voice memo if present
  let transcript = ''
  if (visit.voice_memo_path) {
    const { data: { signedUrl } } = await supabase.storage
      .from('voice-memos')
      .createSignedUrl(visit.voice_memo_path, 900)  // 15 min

    transcript = await transcribeWithAssemblyAI(signedUrl, visitId, supabase)
  }

  // 3. Fetch last 3 visits to same location for context
  const { data: history } = await supabase
    .from('visits')
    .select('visit_date, debriefs(summary, blockers, nudge_flag)')
    .eq('location_id', visit.location_id)
    .neq('id', visitId)
    .order('visit_date', { ascending: false })
    .limit(3)

  // 4. Build and call Groq
  const prompt = DEBRIEF_PROMPT_V1
    .replace('{{location_name}}',       visit.locations.name)
    .replace('{{visit_date}}',          visit.visit_date)
    .replace('{{program_area}}',        visit.program_area)
    .replace('{{stakeholders}}',        (visit.stakeholders || []).join(', '))
    .replace('{{duration_mins}}',       String(visit.duration_mins || 'Not specified'))
    .replace('{{text_notes}}',          visit.text_notes || '(none)')
    .replace('{{transcript}}',          transcript || '(no voice memo)')
    .replace('{{last_3_visits_json}}',  JSON.stringify(history || []))

  const debrief = await callGroqWithRetry(prompt, visitId, supabase)

  if (debrief) {
    await supabase.from('debriefs').insert({ visit_id: visitId, ...debrief })
    await supabase.from('visits').update({ debrief_status: 'done' }).eq('id', visitId)
  }

  return new Response('ok')
})
```

---

## Cron Retry — Picks Up Missed Visits

```sql
-- Runs every 15 minutes via Supabase scheduled Edge Function
-- Picks up: pending visits older than 5 minutes that haven't exceeded retry limit

SELECT * FROM visits
WHERE debrief_status = 'pending'
  AND retry_count < 3
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at ASC
LIMIT 10;
```

---

## AssemblyAI Integration

```ts
async function transcribeWithAssemblyAI(
  audioUrl: string,
  visitId: string,
  supabase: SupabaseClient
): Promise<string> {
  await supabase.from('visits')
    .update({ transcription_status: 'pending' })
    .eq('id', visitId)

  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'authorization': Deno.env.get('ASSEMBLYAI_API_KEY')! },
    body: JSON.stringify({
      audio_url:     audioUrl,
      language_code: 'en',   // V2: add 'kn' for Kannada support
      punctuate:     true,
      format_text:   true,
    }),
  })

  const { id } = await response.json()

  // Poll until complete (timeout after 60s)
  const start = Date.now()
  while (Date.now() - start < 60_000) {
    await new Promise(r => setTimeout(r, 3000))
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'authorization': Deno.env.get('ASSEMBLYAI_API_KEY')! },
    })
    const result = await poll.json()

    if (result.status === 'completed') {
      await supabase.from('visits')
        .update({ transcript: result.text, transcription_status: 'done' })
        .eq('id', visitId)
      return result.text
    }

    if (result.status === 'error') break
  }

  // Timeout or error — continue without transcript
  await supabase.from('visits')
    .update({ transcription_status: 'failed' })
    .eq('id', visitId)
  return ''
}
```

---

## Groq Prompts — `lib/prompts.ts`

> **Rule:** Never edit prompts inline. All versions live here with version strings.
> Version is logged in `audit_logs.metadata.prompt_version`.

### `DEBRIEF_PROMPT_V1`

```ts
export const DEBRIEF_PROMPT_V1 = `
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

Return this exact JSON structure:
{
  "key_findings":        ["string"],
  "blockers":            ["string"],
  "community_sentiment": "Positive" | "Mixed" | "Negative",
  "follow_ups":          ["string"],
  "nudge_flag":          "Routine" | "Needs Attention" | "Escalate",
  "recurring_issues":    ["string — only if same issue appears in location_history"],
  "summary":             "2-3 sentence summary of the visit"
}
`
```

### `PATTERN_PROMPT_V1`

```ts
export const PATTERN_PROMPT_V1 = `
You are a senior program analyst for The/Nudge Foundation.
Analyze the following field visit summaries and blockers from {{visit_count}} visits
across {{filter_description}}.

Write a 3-paragraph intelligence report:
Paragraph 1: Recurring themes and most common findings
Paragraph 2: Dominant blockers and their frequency/severity
Paragraph 3: Sentiment trends and escalation recommendations

Be specific. Reference actual patterns from the data. Do not generalise.

<visit_data>
{{visit_summaries_json}}
</visit_data>
`
```

---

## Client-Side Realtime Subscription

```ts
// In /officer/visits/[id]/page.tsx
useEffect(() => {
  const channel = supabase
    .channel(`visit-${visitId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'visits',
      filter: `id=eq.${visitId}`,
    }, (payload) => {
      const status = payload.new.debrief_status
      if (status === 'done')   fetchAndShowDebrief()
      if (status === 'failed') showFailureState()
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [visitId])
```

---

## UI States for All Scenarios

| State | `debrief_status` | `transcription_status` | Message to Officer |
|---|---|---|---|
| Processing | `pending` | `pending` | "Visit saved — AI debrief generating (usually under 20s)..." |
| Voice failed, debrief ok | `done` | `failed` | *(debrief shown)* "Note: voice processing failed. Your typed notes were used." |
| Debrief failed | `failed` | `done` | "Visit saved successfully. AI summary couldn't be generated — your notes are visible to your manager." |
| Complete | `done` | `done` | *(full debrief card — no banner needed)* |
| Timeout > 60s | `pending` | any | "Taking longer than expected. Check back in a few minutes — your visit is saved." |
| No voice, debrief ok | `done` | `none` | *(full debrief card — no banner needed)* |
