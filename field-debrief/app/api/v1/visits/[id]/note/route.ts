import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { officerNoteSchema } from '@/lib/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = officerNoteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR' } }, { status: 400 })
  }

  // Fetch existing note
  const { data: existing } = await supabase
    .from('debriefs')
    .select('officer_note')
    .eq('visit_id', id)
    .single()

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const newNote = existing?.officer_note
    ? `${existing.officer_note}\n[${timestamp}] ${parsed.data.note}`
    : `[${timestamp}] ${parsed.data.note}`

  const { error } = await supabase
    .from('debriefs')
    .update({ officer_note: newNote })
    .eq('visit_id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR' } }, { status: 500 })

  return NextResponse.json({ officer_note: newNote })
}