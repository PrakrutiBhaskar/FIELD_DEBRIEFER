// app/api/v1/visits/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, region')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: visit, error } = await supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status,
      text_notes, transcript, transcription_status,
      created_at, officer_id,
      locations(name, district),
      debriefs(
        key_findings, blockers, community_sentiment,
        follow_ups, nudge_flag, recurring_issues,
        summary, officer_note, source_citations
      )
    `)
    .eq('id', id)
    .single()

  if (error || !visit) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  // Application-level ownership check
  if (profile.role === 'officer' && visit.officer_id !== user.id) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  if (profile.role === 'manager') {
    const { data: officerProfile } = await supabase
      .from('profiles')
      .select('region')
      .eq('id', visit.officer_id)
      .single()

    if (!officerProfile || officerProfile.region !== profile.region) {
      return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
    }
  }

  return NextResponse.json({ visit })
}