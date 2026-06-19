'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const statusColor: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-600',
  done: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/visits')
      .then(r => r.json())
      .then(d => {
        setVisits(d.visits || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">My Visits</h1>
          <Link
            href="/submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Visit
          </Link>
        </div>

        {loading && (
          <p className="text-slate-400 text-sm text-center py-12">Loading...</p>
        )}

        {!loading && visits.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500 text-sm mb-4">No visits yet</p>
            <Link href="/submit" className="text-blue-600 text-sm hover:underline">
              Submit your first visit →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {visits.map(visit => (
            <Link key={visit.id} href={`/visits/${visit.id}`}>
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-800">{visit.locations?.name}</p>
                    <p className="text-xs text-slate-400">{visit.locations?.district} · {visit.visit_date} · {visit.program_area}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {visit.debriefs?.nudge_flag && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${flagColor[visit.debriefs.nudge_flag]}`}>
                        {visit.debriefs.nudge_flag}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[visit.debrief_status]}`}>
                      {visit.debrief_status}
                    </span>
                  </div>
                </div>
                {visit.debriefs?.summary && (
                  <p className="text-sm text-slate-600 line-clamp-2">{visit.debriefs.summary}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}