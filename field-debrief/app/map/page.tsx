'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { MapPin } from '@/components/visit-map'

const VisitMap = dynamic(() => import('@/components/visit-map'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#EDE7D9', borderRadius: '1rem',
      color: '#6B7C74', fontSize: '0.875rem',
    }}>
      Loading map…
    </div>
  ),
})

const FLAG_LEGEND: { label: string; color: string }[] = [
  { label: 'Routine',         color: '#2D4A3E' },
  { label: 'Needs Attention', color: '#B45309' },
  { label: 'Escalate',        color: '#991B1B' },
  { label: 'Pending debrief', color: '#6B7C74' },
]

const PROGRAM_AREAS = ['Rural Livelihoods', 'Agriculture', 'Skilling', 'Economic Inclusion', 'Other']

const selectStyle = {
  border: '1px solid #DDD6C8', borderRadius: '0.75rem', padding: '0.5rem 0.75rem',
  fontSize: '0.875rem', background: '#FDFAF5', color: '#1E2A22', outline: 'none',
}

export default function MapPage() {
  const [pins, setPins]       = useState<MapPin[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [program, setProgram]   = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to', dateTo)
    if (program)  params.set('program_area', program)

    setLoading(true)
    fetch(`/api/v1/map?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (d.pins) { setPins(d.pins); setFetchError('') }
        else setFetchError(d.error?.message || 'Failed to load map data')
      })
      .catch(() => setFetchError('Failed to load map data. Please refresh.'))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, program])

  const flagCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Routine': 0, 'Needs Attention': 0, 'Escalate': 0, 'Pending debrief': 0 }
    for (const p of pins) {
      if (p.nudge_flag && counts[p.nudge_flag] !== undefined) counts[p.nudge_flag]++
      else counts['Pending debrief']++
    }
    return counts
  }, [pins])

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-5xl mx-auto">

        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>Visit Map</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>
            {pins.length} visits shown · pins approximate to district level
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap items-end">
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#6B7C74', marginBottom: '0.25rem' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selectStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#6B7C74', marginBottom: '0.25rem' }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={selectStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#6B7C74', marginBottom: '0.25rem' }}>Program area</label>
            <select value={program} onChange={e => setProgram(e.target.value)} style={selectStyle}>
              <option value="">All programs</option>
              {PROGRAM_AREAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          {(dateFrom || dateTo || program) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setProgram('') }}
              className="text-sm transition-colors"
              style={{ color: '#B5521B', paddingBottom: '0.55rem' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {fetchError && (
          <div className="rounded-xl p-4 text-sm mb-4"
            style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {fetchError}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 mb-4 flex-wrap">
          {FLAG_LEGEND.map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: item.color, display: 'inline-block',
              }} />
              <span style={{ fontSize: '0.75rem', color: '#4A3728' }}>
                {item.label} ({flagCounts[item.label] ?? 0})
              </span>
            </div>
          ))}
        </div>

        {/* Map */}
        <div style={{
          height: '60vh', minHeight: '420px', borderRadius: '1rem',
          overflow: 'hidden', border: '1px solid #DDD6C8',
          background: '#EDE7D9', position: 'relative',
        }}>
          {loading ? (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#6B7C74', fontSize: '0.875rem',
              gap: '0.5rem',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B5521B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              Loading map…
            </div>
          ) : <VisitMap pins={pins} />}
        </div>

        <p style={{ fontSize: '0.7rem', color: '#A8A29E', marginTop: '0.6rem' }}>
          Pins are placed at an approximate point within each visit's district, not the exact site —
          location-level precision isn't currently captured.
        </p>

      </div>
    </div>
  )
}