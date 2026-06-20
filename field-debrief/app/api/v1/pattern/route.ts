import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { patternRequestSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const body = await request.json()
  const parsed = patternRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }
    }, { status: 400 })
  }

  const { visit_ids, filter_context } = parsed.data

  // Fetch visit summaries
  const { data: visits } = await supabase
    .from('visits')
    .select(`
      visit_date, program_area,
      locations(name),
      debriefs(summary, blockers, nudge_flag, community_sentiment)
    `)
    .in('id', visit_ids)

  if (!visits || visits.length < 3) {
    return NextResponse.json({
      error: { code: 'INSUFFICIENT_DATA', message: 'Need at least 3 visits to generate a pattern report' }
    }, { status: 400 })
  }

  const filterDesc = filter_context
    ? [
        filter_context.location,
        filter_context.program_area,
        filter_context.date_range ? `${filter_context.date_range.from} to ${filter_context.date_range.to}` : null
      ].filter(Boolean).join(', ')
    : 'all selected visits'

  const prompt = `
You are a senior program analyst for The/Nudge Foundation.
Analyze the following field visit summaries and blockers from ${visits.length} visits across ${filterDesc}.

Write a 3-paragraph intelligence report:
Paragraph 1: Recurring themes and most common findings
Paragraph 2: Dominant blockers and their frequency/severity  
Paragraph 3: Sentiment trends and escalation recommendations

Be specific. Reference actual patterns from the data. Do not generalise.

<visit_data>
${JSON.stringify(visits)}
</visit_data>
`

  // Call Groq
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  })

  const groqData = await groqRes.json()
  const report = groqData.choices?.[0]?.message?.content || 'Could not generate report.'

  return NextResponse.json({ report })
}