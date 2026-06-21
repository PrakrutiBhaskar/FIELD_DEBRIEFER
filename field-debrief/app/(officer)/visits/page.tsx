'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/skeleton'

type Visit = {
  id: string
  visit_date: string
  program_area: string
  debrief_status: 'pending' | 'done' | 'failed'
  locations: { name: string; district: string }
  debriefs: { summary: string; nudge_flag: string } | null
}

const FLAG_STYLE: Record<string, { bg: string; color: string }> = {
  'Routine':          { bg: '#E2EDE9', color: '#2D4A3E' },
  'Needs Attention':  { bg: '#FEF3C7', color: '#92400E' },
  'Escalate':         { bg: '#FEE2E2', color: '#991B1B' },
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: 'Generating…', color: '#B5521B', dot: '#F4A261' },
  done:    { label: 'Ready',       color: '#2D4A3E', dot: '#4CAF82' },
  failed:  { label: 'Failed',      color: '#991B1B', dot: '#EF4444' },
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/v1/visits')
      .then(r => r.json())
      .then(d => { setVisits(d.visits || []); setLoading(false) })
      .catch(() => { setError('Failed to load visits. Please refresh.'); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>My Visits</h1>
            {!loading && visits.length > 0 && (
              <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>{visits.length} visits recorded</p>
            )}
          </div>
          <Link href="/submit"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ background: '#B5521B', color: '#FDFAF5' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New
          </Link>
        </div>

        {error && (
          <div className="rounded-xl p-4 text-sm mb-4" style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        {loading && <SkeletonPage />}

        {!loading && visits.length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#FAE8DF' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="#B5521B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="font-semibold mb-2" style={{ color: '#1E2A22' }}>No visits yet</h2>
            <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: '#6B7C74' }}>
              Submit your first field visit and the AI will generate a structured debrief automatically.
            </p>
            <Link href="/submit"
              className="inline-block rounded-xl px-5 py-2.5 text-sm font-medium"
              style={{ background: '#B5521B', color: '#FDFAF5' }}
            >
              Submit your first visit →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {visits.map(visit => {
            const status = STATUS[visit.debrief_status]
            const flag = visit.debriefs?.nudge_flag
            const flagStyle = flag ? FLAG_STYLE[flag] : null
            const isEscalate = flag === 'Escalate'
            return (
              <Link key={visit.id} href={`/visits/${visit.id}`}>
                <div className="rounded-2xl p-5 transition-all hover:shadow-md cursor-pointer"
                  style={{
                    background: '#FDFAF5',
                    border: isEscalate ? 'none' : '1px solid #DDD6C8',
                    outline: isEscalate ? '1px solid #FECACA' : 'none',
                    borderLeft: isEscalate ? '4px solid #EF4444' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold" style={{ color: '#1E2A22' }}>
                        {visit.locations?.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7C74' }}>
                        {visit.locations?.district} · {new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {visit.program_area}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {flagStyle && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: flagStyle.bg, color: flagStyle.color }}>
                          {flag}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full"
                          style={{ background: status.dot, animation: visit.debrief_status === 'pending' ? 'pulse 2s infinite' : 'none' }}></span>
                        <span className="text-xs font-medium" style={{ color: status.color }}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  {visit.debriefs?.summary && (
                    <p className="text-sm line-clamp-2 mt-2" style={{ color: '#6B7C74' }}>
                      {visit.debriefs.summary}
                    </p>
                  )}
                  {visit.debrief_status === 'pending' && (
                    <p className="text-xs mt-2" style={{ color: '#B5521B' }}>AI debrief is being generated…</p>
                  )}
                  {visit.debrief_status === 'failed' && (
                    <p className="text-xs mt-2" style={{ color: '#991B1B' }}>Debrief generation failed. Your notes are saved.</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}