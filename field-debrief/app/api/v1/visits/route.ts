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
  .insert({
    officer_id:       user.id,
    location_id,
    visit_date,
    program_area,
    stakeholders:     stakeholders || [],
    duration_mins,
    text_notes,
    voice_memo_path:  body.voice_memo_path || null,
    photo_paths:      Array.isArray(body.photo_paths) ? body.photo_paths.slice(0, 10) : [],
    debrief_status:   'pending',
  })
  .select('id')
  .single()

  if (error) {
  console.error('DB error:', error.message)
  return NextResponse.json({ error: { code: 'DB_ERROR', message: 'An error occurred. Please try again.' } }, { status: 500 })
}

  return NextResponse.json({ visit_id: (data as { id: string }).id, debrief_status: 'pending' }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize  = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') || '20')))
  const from      = (page - 1) * pageSize
  const to        = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, debrief_status, created_at,
      locations(name, district),
      debriefs(summary, nudge_flag, community_sentiment, blockers)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
  console.error('DB error:', error.message)
  return NextResponse.json({ error: { code: 'DB_ERROR', message: 'An error occurred. Please try again.' } }, { status: 500 })
}

  return NextResponse.json({
    visits:    data,
    total:     count,
    page,
    page_size: pageSize,
  })
}