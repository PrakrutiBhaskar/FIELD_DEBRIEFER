import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Supabase returns joined relations as arrays even for many-to-one /
// 1:1 foreign keys, so `locations`/`debriefs` arrive as `{...}[]`
// rather than `{...} | null`. Unwrap the first element.
const unwrap = <T,>(val: T[] | T | null): T | null =>
  Array.isArray(val) ? (val[0] ?? null) : val

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('date_from')   // 'YYYY-MM-DD'
  const dateTo   = searchParams.get('date_to')     // 'YYYY-MM-DD'
  const program  = searchParams.get('program_area')

  let query = supabase
    .from('visits')
    .select(`
      id, visit_date, program_area,
      locations(name, district),
      debriefs(nudge_flag, community_sentiment, summary)
    `)
    .order('visit_date', { ascending: false })
    .limit(500) // map view caps at 500 most recent matching visits for performance

  if (dateFrom) query = query.gte('visit_date', dateFrom)
  if (dateTo)   query = query.lte('visit_date', dateTo)
  if (program)  query = query.eq('program_area', program)

  const { data, error } = await query

  if (error) {
    console.error('[map] query failed', { errorCode: error.code, errorMessage: error.message })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'An error occurred. Please try again.' } }, { status: 500 })
  }

  const pins = (data as Record<string, any>[] | null)
    ?.map(v => {
      const location = unwrap(v.locations) as { name: string; district: string } | null
      const debrief = unwrap(v.debriefs) as { nudge_flag: string; community_sentiment: string; summary: string } | null
      // A visit isn't placeable on the map without a known district —
      // skip rather than guess at a location.
      if (!location?.district) return null
      return {
        id:            v.id,
        visit_date:    v.visit_date,
        program_area:  v.program_area,
        location_name: location.name,
        district:      location.district,
        nudge_flag:    debrief?.nudge_flag ?? null,
        sentiment:     debrief?.community_sentiment ?? null,
        summary:       debrief?.summary ?? null,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null) ?? []

  return NextResponse.json({ pins, total: pins.length })
}