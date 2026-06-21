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

const flagColor: Record<string, string> = {
  Routine: 'bg-slate-100 text-slate-600',
  'Needs Attention': 'bg-yellow-100 text-yellow-700',
  Escalate: 'bg-red-100 text-red-700',
}

const statusConfig: Record<string, { color: string; dot: string; label: string }> = {
  pending: { color: 'text-blue-600', dot: 'bg-blue-400 animate-pulse', label: 'Generating...' },
  done:    { color: 'text-green-600', dot: 'bg-green-400', label: 'Ready' },
  failed:  { color: 'text-red-500', dot: 'bg-red-400', label: 'Failed' },
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/v1/visits')
      .then(r => r.json())
      .then(d => {
        setVisits(d.visits || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load visits. Please refresh.')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Visits</h1>
            {!loading && visits.length > 0 && (
              <p className="text-slate-500 text-sm mt-1">{visits.length} visits recorded</p>
            )}
          </div>
          <Link
            href="/submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Visit
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {loading && <SkeletonPage />}

        {!loading && visits.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h2 className="text-slate-800 font-semibold mb-2">No visits yet</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              Start by submitting your first field visit. The AI will generate a structured debrief automatically.
            </p>
            <Link
              href="/submit"
              className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors inline-block"
            >
              Submit your first visit →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {visits.map(visit => {
            const status = statusConfig[visit.debrief_status]
            const isEscalate = visit.debriefs?.nudge_flag === 'Escalate'
            return (
              <Link key={visit.id} href={`/visits/${visit.id}`}>
                <div className={`bg-white rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                  isEscalate
                    ? 'border-l-4 border-l-red-400 border-slate-200'
                    : 'border-slate-200 hover:border-blue-200'
                }`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">{visit.locations?.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {visit.locations?.district} · {visit.visit_date} · {visit.program_area}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {visit.debriefs?.nudge_flag && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${flagColor[visit.debriefs.nudge_flag]}`}>
                            {visit.debriefs.nudge_flag}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                          <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                        </div>
                      </div>
                    </div>
                    {visit.debriefs?.summary && (
                      <p className="text-sm text-slate-500 line-clamp-2 mt-2">{visit.debriefs.summary}</p>
                    )}
                    {visit.debrief_status === 'pending' && (
                      <p className="text-xs text-blue-500 mt-2">AI debrief is being generated...</p>
                    )}
                    {visit.debrief_status === 'failed' && (
                      <p className="text-xs text-red-500 mt-2">Debrief generation failed. Your notes are saved.</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}