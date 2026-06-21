'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/components/toast'

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

const sentimentConfig = {
  Positive: { color: 'bg-green-100 text-green-700', icon: '↑' },
  Mixed:    { color: 'bg-yellow-100 text-yellow-700', icon: '→' },
  Negative: { color: 'bg-red-100 text-red-700', icon: '↓' },
}

const flagConfig = {
  Routine:           { color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
  'Needs Attention': { color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
  Escalate:          { color: 'bg-red-100 text-red-700', border: 'border-red-300' },
}

export default function VisitDetailPage() {
  const { id } = useParams()
  const [visit, setVisit] = useState<Visit | null>(null)
  const [status, setStatus] = useState<'pending' | 'done' | 'failed'>('pending')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  const fetchVisit = async () => {
    const res = await fetch(`/api/v1/visits/${id}`)
    const data = await res.json()
    if (data.visit) {
      setVisit(data.visit)
      setStatus(data.visit.debrief_status)
    }
  }

  useEffect(() => { fetchVisit() }, [id])

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
    const res = await fetch(`/api/v1/visits/${id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      toast('Note saved successfully')
      setNote('')
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
      await fetchVisit()
    } else {
      toast('Failed to save note', 'error')
    }
    setSavingNote(false)
  }

  if (!visit) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
        Loading visit...
      </div>
    </div>
  )

  const flag = visit.debriefs?.nudge_flag
  const flagStyle = flag ? flagConfig[flag] : null

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className={`bg-white rounded-xl border p-6 ${
          flag === 'Escalate' ? 'border-l-4 border-l-red-400 border-slate-200' : 'border-slate-200'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{visit.locations.name}</h1>
              <p className="text-slate-500 text-sm mt-1">
                {visit.locations.district} · {visit.visit_date} · {visit.program_area}
              </p>
            </div>
            {flag && flagStyle && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${flagStyle.color}`}>
                {flag === 'Escalate' && '⚠ '}{flag}
              </span>
            )}
          </div>
        </div>

        {/* Pending state */}
        {status === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0"></span>
              <div>
                <p className="text-sm font-medium text-blue-800">AI debrief generating...</p>
                <p className="text-xs text-blue-600 mt-0.5">Usually ready in under 20 seconds. Your visit is saved.</p>
              </div>
            </div>
          </div>
        )}

        {/* Failed state */}
        {status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5" role="alert" aria-live="assertive">
            <div className="flex items-center gap-3">
              <span className="text-red-500 text-lg flex-shrink-0">✕</span>
              <div>
                <p className="text-sm font-medium text-red-800">AI summary couldn't be generated</p>
                <p className="text-xs text-red-600 mt-0.5">Your visit notes are saved and visible to your manager.</p>
              </div>
            </div>
          </div>
        )}

        {/* Success debrief card */}
        {status === 'done' && visit.debriefs && (
          <>
            {/* Success banner */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-green-500 text-lg flex-shrink-0">✓</span>
              <div>
                <p className="text-sm font-medium text-green-800">AI debrief ready</p>
                <p className="text-xs text-green-600 mt-0.5">Review the structured intelligence below.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

              {/* Summary */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Summary</p>
                <p className="text-sm text-slate-700 leading-relaxed">{visit.debriefs.summary}</p>
              </div>

              {/* Sentiment */}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${sentimentConfig[visit.debriefs.community_sentiment].color}`}>
                  {sentimentConfig[visit.debriefs.community_sentiment].icon} {visit.debriefs.community_sentiment} sentiment
                </span>
              </div>

              {/* Key findings */}
              {visit.debriefs.key_findings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Key Findings</p>
                  <ul className="space-y-1.5">
                    {visit.debriefs.key_findings.map((f, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2.5 items-start">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blockers */}
              {visit.debriefs.blockers.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Blockers</p>
                  <ul className="space-y-1.5">
                    {visit.debriefs.blockers.map((b, i) => (
                      <li key={i} className="text-sm text-red-700 flex gap-2.5 items-start">
                        <span className="mt-0.5 flex-shrink-0">✕</span>{b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-ups */}
              {visit.debriefs.follow_ups.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Follow-ups</p>
                  <ul className="space-y-1.5">
                    {visit.debriefs.follow_ups.map((f, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2.5 items-start">
                        <span className="text-yellow-500 mt-0.5 flex-shrink-0">→</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recurring issues */}
              {visit.debriefs.recurring_issues.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">Recurring Issues</p>
                  <ul className="space-y-1.5">
                    {visit.debriefs.recurring_issues.map((r, i) => (
                      <li key={i} className="text-sm text-orange-700 flex gap-2.5 items-start">
                        <span className="mt-0.5 flex-shrink-0">⚠</span>{r}
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
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{visit.debriefs.officer_note}</p>
                </div>
              )}
              {noteSaved && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <span>✓</span> Note saved
                </div>
              )}
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note to this debrief..."
                aria-label="Add officer note"
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