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

  // Validate UUID format
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  }

  // Get profile for role-based access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, region')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  // Build query with explicit ownership check based on role
  let query = supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status, text_notes, created_at,
      locations(name, district),
      debriefs(key_findings, blockers, community_sentiment, follow_ups, nudge_flag, recurring_issues, summary, officer_note)
    `)
    .eq('id', id)

  // Officers can only see their own visits
  if (profile.role === 'officer') {
    query = query.eq('officer_id', user.id)
  }

  // Managers can only see visits from their region
  if (profile.role === 'manager') {
    query = query.eq('profiles.region', profile.region)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  return NextResponse.json({ visit: data })
}