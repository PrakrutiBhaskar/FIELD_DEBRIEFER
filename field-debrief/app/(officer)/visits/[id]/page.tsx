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
  id: string; visit_date: string; program_area: string
  debrief_status: 'pending' | 'done' | 'failed'
  locations: { name: string; district: string }
  debriefs: Debrief | null
}

const SENTIMENT = {
  Positive: { bg: '#DCFCE7', color: '#166534', label: 'Positive sentiment' },
  Mixed:    { bg: '#FEF9C3', color: '#713F12', label: 'Mixed sentiment' },
  Negative: { bg: '#FEE2E2', color: '#991B1B', label: 'Negative sentiment' },
}

const FLAG = {
  'Routine':          { bg: '#E2EDE9', color: '#2D4A3E' },
  'Needs Attention':  { bg: '#FEF3C7', color: '#92400E' },
  'Escalate':         { bg: '#FEE2E2', color: '#991B1B' },
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7C74' }}>
    {children}
  </p>
)

export default function VisitDetailPage() {
  const { id } = useParams()
  const [visit, setVisit] = useState<Visit | null>(null)
  const [status, setStatus] = useState<'pending' | 'done' | 'failed'>('pending')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const fetchVisit = async () => {
    const res = await fetch(`/api/v1/visits/${id}`)
    const data = await res.json()
    if (data.visit) { setVisit(data.visit); setStatus(data.visit.debrief_status) }
  }

  useEffect(() => { fetchVisit() }, [id])
  useEffect(() => {
    if (status !== 'pending') return
    const interval = setInterval(fetchVisit, 5000)
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
    if (res.ok) { toast('Note saved'); setNote(''); await fetchVisit() }
    else toast('Failed to save note', 'error')
    setSavingNote(false)
  }

  if (!visit) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F0E8' }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7C74' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#B5521B' }}></span>
        Loading visit…
      </div>
    </div>
  )

  const flag = visit.debriefs?.nudge_flag
  const flagStyle = flag ? FLAG[flag] : null
  const isEscalate = flag === 'Escalate'

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header card */}
        <div className="rounded-2xl p-5"
          style={{
            background: '#FDFAF5',
            border: '1px solid #DDD6C8',
            borderLeft: isEscalate ? '4px solid #EF4444' : undefined,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#1E2A22' }}>{visit.locations.name}</h1>
              <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>
                {visit.locations.district} · {new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {visit.program_area}
              </p>
            </div>
            {flagStyle && flag && (
              <span className="text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: flagStyle.bg, color: flagStyle.color }}>
                {isEscalate && '⚠ '}{flag}
              </span>
            )}
          </div>
        </div>

        {/* Pending */}
        {status === 'pending' && (
          <div className="rounded-2xl p-5" role="status" aria-live="polite"
            style={{ background: '#FAE8DF', border: '1px solid #F4BFA3' }}>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: '#B5521B' }}></span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#7C2D12' }}>AI debrief generating…</p>
                <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>Usually ready in under 20 seconds. Your visit is saved.</p>
              </div>
            </div>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="rounded-2xl p-5" role="alert"
            style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-lg" style={{ color: '#EF4444' }}>✕</span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#7F1D1D' }}>AI summary couldn't be generated</p>
                <p className="text-xs mt-0.5" style={{ color: '#991B1B' }}>Your visit notes are saved and visible to your manager.</p>
              </div>
            </div>
          </div>
        )}

        {/* Debrief */}
        {status === 'done' && visit.debriefs && (
          <>
            {/* Summary card */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
              <div>
                <SectionLabel>Summary</SectionLabel>
                <p className="text-sm leading-relaxed" style={{ color: '#1E2A22' }}>{visit.debriefs.summary}</p>
                <div className="mt-3">
                  <span className="text-xs font-medium px-3 py-1 rounded-full"
                    style={SENTIMENT[visit.debriefs.community_sentiment]}>
                    {SENTIMENT[visit.debriefs.community_sentiment].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Findings */}
            {visit.debriefs.key_findings.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
                <SectionLabel>Key Findings</SectionLabel>
                <ul className="space-y-2">
                  {visit.debriefs.key_findings.map((f, i) => (
                    <li key={i} className="text-sm flex gap-2.5 items-start" style={{ color: '#1E2A22' }}>
                      <span className="mt-0.5 shrink-0" style={{ color: '#B5521B' }}>·</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blockers */}
            {visit.debriefs.blockers.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <SectionLabel>Blockers</SectionLabel>
                <ul className="space-y-2">
                  {visit.debriefs.blockers.map((b, i) => (
                    <li key={i} className="text-sm flex gap-2.5 items-start" style={{ color: '#7F1D1D' }}>
                      <span className="mt-0.5 shrink-0">✕</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-ups */}
            {visit.debriefs.follow_ups.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
                <SectionLabel>Follow-ups</SectionLabel>
                <ul className="space-y-2">
                  {visit.debriefs.follow_ups.map((f, i) => (
                    <li key={i} className="text-sm flex gap-2.5 items-start" style={{ color: '#1E2A22' }}>
                      <span className="mt-0.5 shrink-0" style={{ color: '#2D4A3E' }}>→</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recurring issues */}
            {visit.debriefs.recurring_issues.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <SectionLabel>Recurring Issues</SectionLabel>
                <ul className="space-y-2">
                  {visit.debriefs.recurring_issues.map((r, i) => (
                    <li key={i} className="text-sm flex gap-2.5 items-start" style={{ color: '#78350F' }}>
                      <span className="mt-0.5 shrink-0">⚠</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Officer note */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
              <SectionLabel>Your Note</SectionLabel>
              {visit.debriefs.officer_note && (
                <div className="rounded-xl p-3" style={{ background: '#F5F0E8', border: '1px solid #DDD6C8' }}>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#4A3728' }}>{visit.debriefs.officer_note}</p>
                </div>
              )}
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Add a note to this debrief…"
                style={{
                  width: '100%', border: '1px solid #DDD6C8', borderRadius: '0.75rem',
                  padding: '0.625rem 0.75rem', fontSize: '0.875rem', background: '#FDFAF5',
                  color: '#1E2A22', resize: 'none', outline: 'none',
                }} />
              <button onClick={handleNoteSubmit} disabled={savingNote || !note.trim()}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ background: '#2D4A3E', color: '#FDFAF5', opacity: (savingNote || !note.trim()) ? 0.5 : 1 }}>
                {savingNote ? 'Saving…' : 'Add note'}
              </button>
            </div>
          </>
        )}

        <div className="pt-2">
          <a href="/visits" className="text-sm font-medium transition-colors" style={{ color: '#B5521B' }}>
            ← Back to My Visits
          </a>
        </div>
      </div>
    </div>
  )
}