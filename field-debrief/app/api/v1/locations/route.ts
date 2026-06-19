import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data, error } = await supabase
    .from('locations')
    .select('id, name, district')
    .eq('is_verified', true)
    .order('name')

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR' } }, { status: 500 })

  return NextResponse.json({ locations: data })
}