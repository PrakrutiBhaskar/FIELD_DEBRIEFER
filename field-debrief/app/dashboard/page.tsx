'use client'

import { useEffect, useState } from 'react'
import { SkeletonPage } from '@/components/skeleton'
import { toast } from '@/components/toast'

type Visit = {
  id: string; visit_date: string; program_area: string; debrief_status: string
  locations: { name: string; district: string }
  debriefs: { summary: string; nudge_flag: string; community_sentiment: string; blockers: string[] } | null
  profiles: { full_name: string }
}

const FLAG: Record<string, { bg: string; color: string }> = {
  'Routine':         { bg: '#E2EDE9', color: '#2D4A3E' },
  'Needs Attention': { bg: '#FEF3C7', color: '#92400E' },
  'Escalate':        { bg: '#FEE2E2', color: '#991B1B' },
}
const SENTIMENT: Record<string, { bg: string; color: string }> = {
  'Positive': { bg: '#DCFCE7', color: '#166534' },
  'Mixed':    { bg: '#FEF9C3', color: '#713F12' },
  'Negative': { bg: '#FEE2E2', color: '#991B1B' },
}

export default function ManagerDashboard() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [report, setReport] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [filterFlag, setFilterFlag] = useState('')
  const [filterProgram, setFilterProgram] = useState('')

  useEffect(() => {
    fetch('/api/v1/visits?page_size=50')
      .then(r => r.json())
      .then(d => { setVisits(d.visits || []); setLoading(false) })
      .catch(() => { setFetchError('Failed to load visits. Please refresh.'); setLoading(false) })
  }, [])

  const filtered = visits.filter(v => {
    if (filterFlag && v.debriefs?.nudge_flag !== filterFlag) return false
    if (filterProgram && v.program_area !== filterProgram) return false
    return true
  })

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generateReport = async () => {
    if (selected.length < 3) { toast('Select at least 3 visits to generate a report', 'info'); return }
    setGeneratingReport(true); setReport('')
    const res = await fetch('/api/v1/pattern', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_ids: selected }),
    })
    const data = await res.json()
    if (res.ok) { setReport(data.report || ''); toast('Pattern report generated') }
    else toast('Failed to generate report', 'error')
    setGeneratingReport(false)
  }

  const selectStyle = {
    border: '1px solid #DDD6C8', borderRadius: '0.75rem', padding: '0.5rem 0.75rem',
    fontSize: '0.875rem', background: '#FDFAF5', color: '#1E2A22', outline: 'none',
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>Manager Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>
              {filtered.length} visits · {selected.length > 0 && `${selected.length} selected`}
            </p>
          </div>
          <button onClick={generateReport}
            disabled={selected.length < 3 || generatingReport}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: selected.length >= 3 ? '#B5521B' : '#DDD6C8',
              color: selected.length >= 3 ? '#FDFAF5' : '#6B7C74',
              cursor: selected.length < 3 ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingReport ? 'Generating…' : `Pattern report (${selected.length} selected)`}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <select value={filterFlag} onChange={e => setFilterFlag(e.target.value)} style={selectStyle}>
            <option value="">All flags</option>
            <option>Routine</option>
            <option>Needs Attention</option>
            <option>Escalate</option>
          </select>
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={selectStyle}>
            <option value="">All programs</option>
            <option>Rural Livelihoods</option>
            <option>Agriculture</option>
            <option>Skilling</option>
            <option>Economic Inclusion</option>
            <option>Other</option>
          </select>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])}
              className="text-sm transition-colors" style={{ color: '#B5521B' }}>
              Clear selection
            </button>
          )}
        </div>

        {fetchError && (
          <div className="rounded-xl p-4 text-sm mb-4"
            style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {fetchError}
          </div>
        )}

        {/* Pattern report */}
        {report && (
          <div className="rounded-2xl p-6 mb-5" style={{ background: '#FDFAF5', border: '1px solid #B5521B' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: '#1E2A22' }}>Pattern Report</h2>
              <button onClick={() => navigator.clipboard.writeText(report)}
                className="text-xs font-medium" style={{ color: '#B5521B' }}>Copy</button>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#4A3728' }}>{report}</p>
          </div>
        )}

        {loading && <SkeletonPage />}

        <div className="space-y-3">
          {filtered.map(visit => {
            const isEscalate = visit.debriefs?.nudge_flag === 'Escalate'
            const flag = visit.debriefs?.nudge_flag
            const sent = visit.debriefs?.community_sentiment
            const isSelected = selected.includes(visit.id)
            return (
              <div key={visit.id} className="rounded-2xl transition-all"
                style={{
                  background: '#FDFAF5',
                  border: isEscalate ? 'none' : '1px solid #DDD6C8',
                  outline: isSelected ? '2px solid #B5521B' : isEscalate ? '1px solid #FECACA' : 'none',
                  borderLeft: isEscalate ? '4px solid #EF4444' : undefined,
                }}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {/* Custom checkbox */}
                    <button type="button" onClick={() => toggleSelect(visit.id)}
                      className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        border: isSelected ? 'none' : '1.5px solid #DDD6C8',
                        background: isSelected ? '#B5521B' : 'transparent',
                      }}
                    >
                      {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>}
                    </button>

                    <div className="flex-1 cursor-pointer"
                      onClick={() => setExpanded(expanded === visit.id ? null : visit.id)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium" style={{ color: '#1E2A22' }}>{visit.locations?.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#6B7C74' }}>
                            {visit.locations?.district} · {new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {visit.program_area}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-3">
                          {flag && FLAG[flag] && (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={FLAG[flag]}>{flag}</span>
                          )}
                          {sent && SENTIMENT[sent] && (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={SENTIMENT[sent]}>{sent}</span>
                          )}
                        </div>
                      </div>
                      {visit.debriefs?.summary && (
                        <p className="text-sm mt-2 line-clamp-2" style={{ color: '#6B7C74' }}>
                          {visit.debriefs.summary}
                        </p>
                      )}

                      {expanded === visit.id && (visit.debriefs?.blockers?.length ?? 0) > 0 && (
                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #EDE7D9' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7C74' }}>
                            Blockers
                          </p>
                          <ul className="space-y-1.5">
                            {(visit.debriefs?.blockers ?? []).map((b, i) => (
                              <li key={i} className="text-sm flex gap-2" style={{ color: '#4A3728' }}>
                                <span style={{ color: '#B5521B' }}>·</span>{b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}