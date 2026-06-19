'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Debrief = {
  key_findings: string[]
  blockers: string[]
  community_sentiment: 'Positive' | 'Mixed' | 'Negative'
  follow_ups: string[]
  nudge_flag: 'Routine' | 'Needs Attention' | 'Escalate'
  recurring_issues: string[]
  summary: string
  officer_note: string | null
}

type Visit = {
  id: string
  visit_date: string
  program_area: string
  debrief_status: 'pending' | 'done' | 'failed'
  locations: { name: string; district: string }
  debriefs: Debrief | null
}

const sentimentColor = {
  Positive: 'bg-green-100 text-green-700',
  Mixed: 'bg-yellow-100 text-yellow-700',
  Negative: 'bg-red-100 text-red-700',
}

const flagColor = {
  Routine: 'bg-slate-100 text-slate-600',
  'Needs Attention': 'bg-yellow-100 text-yellow-700',
  Escalate: 'bg-red-100 text-red-700',
}

export default function VisitDetailPage() {
  const { id } = useParams()
  const [visit, setVisit] = useState<Visit | null>(null)
  const [status, setStatus] = useState<'pending' | 'done' | 'failed'>('pending')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const fetchVisit = async () => {
    const res = await fetch(`/api/v1/visits/${id}`)
    const data = await res.json()
    if (data.visit) {
      setVisit(data.visit)
      setStatus(data.visit.debrief_status)
    }
  }

  useEffect(() => {
    fetchVisit()
  }, [id])

  // Poll if pending
  useEffect(() => {
    if (status !== 'pending') return
    const interval = setInterval(async () => {
      await fetchVisit()
    }, 5000)
    return () => clearInterval(interval)
  }, [status])

  const handleNoteSubmit = async () => {
    if (!note.trim()) return
    setSavingNote(true)
    await fetch(`/api/v1/visits/${id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    setNote('')
    await fetchVisit()
    setSavingNote(false)
  }

  if (!visit) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{visit.locations.name}</h1>
              <p className="text-slate-500 text-sm">{visit.locations.district} · {visit.visit_date} · {visit.program_area}</p>
            </div>
            {visit.debriefs && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${flagColor[visit.debriefs.nudge_flag]}`}>
                {visit.debriefs.nudge_flag}
              </span>
            )}
          </div>
        </div>

        {/* Debrief status */}
        {status === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-700">
            ⏳ Visit saved — AI debrief generating (usually under 20s)...
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
            Visit saved successfully. AI summary couldn't be generated — your notes are visible to your manager.
          </div>
        )}

        {/* Debrief card */}
        {status === 'done' && visit.debriefs && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <h2 className="font-semibold text-slate-800">AI Debrief</h2>

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase mb-2">Summary</p>
                <p className="text-sm text-slate-700">{visit.debriefs.summary}</p>
              </div>

              <div className="flex gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${sentimentColor[visit.debriefs.community_sentiment]}`}>
                  {visit.debriefs.community_sentiment} sentiment
                </span>
              </div>

              {visit.debriefs.key_findings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-2">Key Findings</p>
                  <ul className="space-y-1">
                    {visit.debriefs.key_findings.map((f, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visit.debriefs.blockers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-2">Blockers</p>
                  <ul className="space-y-1">
                    {visit.debriefs.blockers.map((b, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-red-400 mt-0.5">•</span>{b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visit.debriefs.follow_ups.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-2">Follow-ups</p>
                  <ul className="space-y-1">
                    {visit.debriefs.follow_ups.map((f, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-yellow-400 mt-0.5">→</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visit.debriefs.recurring_issues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-2">Recurring Issues</p>
                  <ul className="space-y-1">
                    {visit.debriefs.recurring_issues.map((r, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-orange-400 mt-0.5">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Officer note */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <h2 className="font-semibold text-slate-800">Your Note</h2>
              {visit.debriefs.officer_note && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
                  {visit.debriefs.officer_note}
                </p>
              )}
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note to this debrief..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                onClick={handleNoteSubmit}
                disabled={savingNote || !note.trim()}
                className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </>
        )}

        <div className="pt-2">
          <a href="/visits" className="text-sm text-blue-600 hover:underline">← Back to My Visits</a>
        </div>
      </div>
    </div>
  )
}