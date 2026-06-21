'use client'

import { useEffect, useState } from 'react'
import { SkeletonPage } from '@/components/skeleton'
import { toast } from '@/components/toast'

type Visit = {
  id: string
  visit_date: string
  program_area: string
  debrief_status: string
  locations: { name: string; district: string }
  debriefs: {
    summary: string
    nudge_flag: string
    community_sentiment: string
    blockers: string[]
  } | null
  profiles: { full_name: string }
}

const flagColor: Record<string, string> = {
  Routine: 'bg-slate-100 text-slate-600',
  'Needs Attention': 'bg-yellow-100 text-yellow-700',
  Escalate: 'bg-red-100 text-red-700',
}

const sentimentColor: Record<string, string> = {
  Positive: 'bg-green-100 text-green-700',
  Mixed: 'bg-yellow-100 text-yellow-700',
  Negative: 'bg-red-100 text-red-700',
}

export default function ManagerDashboard() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [report, setReport] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // Filters
  const [filterFlag, setFilterFlag] = useState('')
  const [filterProgram, setFilterProgram] = useState('')

  useEffect(() => {
    fetch('/api/v1/visits?page_size=50')
  .then(r => r.json())
  .then(d => {
    setVisits(d.visits || [])
    setLoading(false)
  })
  .catch(() => {
    setFetchError('Failed to load visits. Please refresh.')
    
    setLoading(false)
  })
  }, [])

  const filtered = visits.filter(v => {
    if (filterFlag && v.debriefs?.nudge_flag !== filterFlag) return false
    if (filterProgram && v.program_area !== filterProgram) return false
    return true
  })

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const generateReport = async () => {
  if (selected.length < 3) {
    toast('Select at least 3 visits to generate a report', 'info')
    return
  }
  setGeneratingReport(true)
  setReport('')
  const res = await fetch('/api/v1/pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visit_ids: selected }),
  })
  const data = await res.json()
  if (res.ok) {
    setReport(data.report || '')
    toast('Pattern report generated')
  } else {
    toast('Failed to generate report', 'error')
  }
  setGeneratingReport(false)
}

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manager Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">{filtered.length} visits</p>
          </div>
          <button
            onClick={generateReport}
            disabled={selected.length < 3 || generatingReport}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingReport ? 'Generating...' : `Pattern Report (${selected.length} selected)`}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <select
            value={filterFlag}
            onChange={e => setFilterFlag(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All flags</option>
            <option>Routine</option>
            <option>Needs Attention</option>
            <option>Escalate</option>
          </select>
          <select
            value={filterProgram}
            onChange={e => setFilterProgram(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All programs</option>
            <option>Rural Livelihoods</option>
            <option>Agriculture</option>
            <option>Skilling</option>
            <option>Economic Inclusion</option>
            <option>Other</option>
          </select>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Clear selection
            </button>
          )}
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
            {fetchError}
          </div>
        )}

        {/* Pattern Report */}
        {report && (
          <div className="bg-white rounded-xl border border-blue-200 p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">Pattern Report</h2>
              <button
                onClick={() => navigator.clipboard.writeText(report)}
                className="text-xs text-blue-600 hover:underline"
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report}</p>
          </div>
        )}

        {loading && <SkeletonPage />}

        {/* Visit list */}
        <div className="space-y-3">
          {filtered.map(visit => (
            <div
              key={visit.id}
              className={`bg-white rounded-xl border transition-colors ${
                visit.debriefs?.nudge_flag === 'Escalate'
                  ? 'border-l-4 border-l-red-400 border-slate-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(visit.id)}
                    onChange={() => toggleSelect(visit.id)}
                    className="mt-1 rounded"
                  />
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setExpanded(expanded === visit.id ? null : visit.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{visit.locations?.name}</p>
                        <p className="text-xs text-slate-400">
                          {visit.locations?.district} · {visit.visit_date} · {visit.program_area}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {visit.debriefs?.nudge_flag && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${flagColor[visit.debriefs.nudge_flag]}`}>
                            {visit.debriefs.nudge_flag}
                          </span>
                        )}
                        {visit.debriefs?.community_sentiment && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${sentimentColor[visit.debriefs.community_sentiment]}`}>
                            {visit.debriefs.community_sentiment}
                          </span>
                        )}
                      </div>
                    </div>
                    {visit.debriefs?.summary && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{visit.debriefs.summary}</p>
                    )}
                  </div>
                </div>

                {/* Expanded debrief */}
                {expanded === visit.id && visit.debriefs && (
                  <div className="mt-4 ml-7 space-y-3 border-t border-slate-100 pt-4">
                    {visit.debriefs.blockers?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase mb-1">Blockers</p>
                        <ul className="space-y-1">
                          {visit.debriefs.blockers.map((b, i) => (
                            <li key={i} className="text-sm text-slate-700 flex gap-2">
                              <span className="text-red-400">•</span>{b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}