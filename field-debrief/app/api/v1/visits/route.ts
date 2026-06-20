import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { visitSubmitSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await request.json()
  const parsed = visitSubmitSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
     error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }
    }, { status: 400 })
  }

  const { location_id, visit_date, program_area, stakeholders, duration_mins, text_notes } = parsed.data

  if (!text_notes && !body.voice_memo_path) {
    return NextResponse.json({
      error: { code: 'NOTES_REQUIRED', message: 'Please provide text notes or a voice memo' }
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status, created_at,
      locations(name, district),
      debriefs(summary, nudge_flag, community_sentiment, blockers)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ visit_id: data.id, debrief_status: 'pending' }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data, error } = await supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status, created_at,
      locations(name, district),
      debriefs(summary, nudge_flag)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR' } }, { status: 500 })

  return NextResponse.json({ visits: data })
}