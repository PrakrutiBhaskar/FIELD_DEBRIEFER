import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status, text_notes, created_at,
      locations(name, district),
      debriefs(key_findings, blockers, community_sentiment, follow_ups, nudge_flag, recurring_issues, summary, officer_note)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  return NextResponse.json({ visit: data })
}