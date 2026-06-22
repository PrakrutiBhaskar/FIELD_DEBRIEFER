'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/components/toast'
import type { SourceCitation } from '@/lib/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

type Debrief = {
  key_findings:        string[]
  blockers:            string[]
  community_sentiment: 'Positive' | 'Mixed' | 'Negative'
  follow_ups:          string[]
  nudge_flag:          'Routine' | 'Needs Attention' | 'Escalate'
  recurring_issues:    string[]
  summary:             string
  officer_note:        string | null
  source_citations:    SourceCitation[]
}

type Visit = {
  id:                   string
  visit_date:           string
  program_area:         string
  debrief_status:       'pending' | 'done' | 'failed'
  text_notes:           string | null
  transcript:           string | null
  transcription_status: 'none' | 'pending' | 'done' | 'failed'
  locations:            { name: string; district: string }
  debriefs:             Debrief | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:        '#F5F0E8',
  surface:   '#FDFAF5',
  border:    '#DDD6C8',
  borderAlt: '#EDE7D9',
  text:      '#1E2A22',
  muted:     '#6B7C74',
  accent:    '#B5521B',
  accentBg:  '#FAE8DF',
  dark:      '#4A3728',
}

const SENTIMENT = {
  Positive: { bg: '#DCFCE7', color: '#166534', label: 'Positive sentiment' },
  Mixed:    { bg: '#FEF9C3', color: '#713F12', label: 'Mixed sentiment'    },
  Negative: { bg: '#FEE2E2', color: '#991B1B', label: 'Negative sentiment' },
}

const FLAG = {
  'Routine':         { bg: '#E2EDE9', color: '#2D4A3E' },
  'Needs Attention': { bg: '#FEF3C7', color: '#92400E' },
  'Escalate':        { bg: '#FEE2E2', color: '#991B1B' },
}

// ─── Sentence splitting ───────────────────────────────────────────────────────
// Must match the boundary the prompt instructs Claude to use.

function splitSentences(text: string): string[] {
  // Split on ". ", "! ", "? " but keep the punctuation attached to its sentence.
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

// ─── SourcePanel — highlighted transcript / notes pane ────────────────────────

type SourcePanelProps = {
  text:             string | null
  label:            string
  activeSentences:  number[]   // sentence indices to highlight
  onSentenceClick?: (idx: number) => void
}

function SourcePanel({ text, label, activeSentences, onSentenceClick }: SourcePanelProps) {
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (activeSentences.length > 0) {
      const first = sentenceRefs.current[activeSentences[0]]
      first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSentences])

  if (!text) return null

  const sentences = splitSentences(text)

  return (
    <div>
      <p style={{
        fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: C.muted, marginBottom: '0.5rem',
      }}>
        {label}
      </p>
      <div style={{
        fontSize: '0.82rem', lineHeight: 1.75, color: C.dark,
        maxHeight: '18rem', overflowY: 'auto',
        padding: '0.875rem', borderRadius: '0.75rem',
        background: '#F9F5EF', border: `1px solid ${C.borderAlt}`,
        scrollbarWidth: 'thin',
      }}>
        {sentences.map((sentence, idx) => {
          const isActive = activeSentences.includes(idx)
          return (
            <span
              key={idx}
              ref={el => { sentenceRefs.current[idx] = el }}
              onClick={() => onSentenceClick?.(idx)}
              title={`Sentence ${idx + 1}`}
              style={{
                display:         'inline',
                background:      isActive ? '#FEF08A' : 'transparent',
                borderRadius:    isActive ? '3px'     : '0',
                outline:         isActive ? `1.5px solid #CA8A04` : 'none',
                padding:         isActive ? '0 2px' : '0',
                cursor:          'default',
                transition:      'background 0.15s, outline 0.15s',
              }}
            >
              {sentence}{' '}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── CitableItem — a single finding/blocker row with citation trigger ─────────

type CitableItemProps = {
  text:        string
  citation:    SourceCitation | undefined
  isActive:    boolean
  onActivate:  () => void
  onDeactivate: () => void
  bullet:      React.ReactNode
  color:       string
}

function CitableItem({
  text, citation, isActive, onActivate, onDeactivate, bullet, color,
}: CitableItemProps) {
  const hasCitation = citation && citation.sentence_indices.length > 0

  return (
    <li
      style={{
        display:       'flex',
        gap:           '0.5rem',
        alignItems:    'flex-start',
        padding:       '0.35rem 0.5rem',
        borderRadius:  '0.5rem',
        background:    isActive ? C.accentBg : 'transparent',
        border:        isActive ? `1px solid #F4BFA3` : '1px solid transparent',
        cursor:        hasCitation ? 'pointer' : 'default',
        transition:    'background 0.15s, border 0.15s',
        userSelect:    'none',
      }}
      onMouseEnter={() => hasCitation && onActivate()}
      onMouseLeave={() => hasCitation && onDeactivate()}
      onClick={() => hasCitation && (isActive ? onDeactivate() : onActivate())}
      role={hasCitation ? 'button' : undefined}
      aria-pressed={hasCitation ? isActive : undefined}
      title={hasCitation
        ? `Source: sentence${citation.sentence_indices.length > 1 ? 's' : ''} ${citation.sentence_indices.map(i => i + 1).join(', ')} in ${citation.source}`
        : undefined}
    >
      <span style={{ color, marginTop: '0.15rem', flexShrink: 0 }}>{bullet}</span>
      <span style={{ fontSize: '0.875rem', color, flex: 1, lineHeight: 1.55 }}>{text}</span>
      {hasCitation && (
        <span style={{
          fontSize:     '0.65rem',
          fontWeight:   600,
          color:        isActive ? C.accent : C.muted,
          marginTop:    '0.2rem',
          flexShrink:   0,
          border:       `1px solid ${isActive ? '#F4BFA3' : C.border}`,
          borderRadius: '99px',
          padding:      '0.1rem 0.45rem',
          lineHeight:   1,
          transition:   'color 0.15s, border 0.15s',
        }}>
          ↗ {citation.source === 'transcript' ? 'transcript' : 'notes'}
        </span>
      )}
    </li>
  )
}

// ─── CitableSection ───────────────────────────────────────────────────────────

type Field = 'key_findings' | 'blockers' | 'follow_ups' | 'recurring_issues'

type CitableSectionProps = {
  label:        string
  items:        string[]
  field:        Field
  citations:    SourceCitation[]
  activeKey:    string | null
  onActivate:   (key: string, citation: SourceCitation) => void
  onDeactivate: () => void
  bullet:       (i: number) => React.ReactNode
  color:        string
  cardStyle:    React.CSSProperties
}

function CitableSection({
  label, items, field, citations,
  activeKey, onActivate, onDeactivate,
  bullet, color, cardStyle,
}: CitableSectionProps) {
  if (items.length === 0) return null
  return (
    <div style={{ borderRadius: '1rem', padding: '1.1rem 1.1rem 0.75rem', ...cardStyle }}>
      <SectionLabel>{label}</SectionLabel>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {items.map((item, i) => {
          const key  = `${field}:${i}`
          const cite = citations.find(c => c.field === field && c.index === i)
          return (
            <CitableItem
              key={key}
              text={item}
              citation={cite}
              isActive={activeKey === key}
              onActivate={() => cite && onActivate(key, cite)}
              onDeactivate={onDeactivate}
              bullet={bullet(i)}
              color={color}
            />
          )
        })}
      </ul>
      {items.some((_, i) => {
        const c = citations.find(c => c.field === field && c.index === i)
        return c && c.sentence_indices.length > 0
      }) && (
        <p style={{ fontSize: '0.68rem', color: C.muted, marginTop: '0.6rem', paddingLeft: '0.5rem' }}>
          Hover or tap a row with <span style={{ fontWeight: 600, color: C.accent }}>↗</span> to see its source sentence
        </p>
      )}
    </div>
  )
}

// ─── Shared label ─────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: C.muted, marginBottom: '0.5rem',
  }}>
    {children}
  </p>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params?: Promise<Record<string, string>>
  searchParams?: Promise<Record<string, string | string[]>>
}

export default function VisitDetailPage(_props: PageProps) {
  const { id } = useParams()
  const [visit, setVisit]           = useState<Visit | null>(null)
  const [status, setStatus]         = useState<'pending' | 'done' | 'failed'>('pending')
  const [note, setNote]             = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Citation interaction state
  const [activeKey,        setActiveKey]        = useState<string | null>(null)
  const [activeCitation,   setActiveCitation]   = useState<SourceCitation | null>(null)
  const [sourceTab,        setSourceTab]        = useState<'transcript' | 'notes'>('transcript')

  const fetchVisit = async () => {
    const res  = await fetch(`/api/v1/visits/${id}`)
    const data = await res.json()
    if (data.visit) {
      setVisit(data.visit)
      setStatus(data.visit.debrief_status)
    }
  }

  useEffect(() => { fetchVisit() }, [id])
  useEffect(() => {
    if (status !== 'pending') return
    const interval = setInterval(fetchVisit, 5000)
    return () => clearInterval(interval)
  }, [status])

  const handleActivate = (key: string, citation: SourceCitation) => {
    setActiveKey(key)
    setActiveCitation(citation)
    setSourceTab(citation.source === 'transcript' ? 'transcript' : 'notes')
  }
  const handleDeactivate = () => {
    setActiveKey(null)
    setActiveCitation(null)
  }

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: C.muted }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
        Loading visit…
      </div>
    </div>
  )

  const debrief    = visit.debriefs
  const flag       = debrief?.nudge_flag
  const flagStyle  = flag ? FLAG[flag] : null
  const isEscalate = flag === 'Escalate'
  const citations  = debrief?.source_citations ?? []

  // Determine which text pane to show for the active citation
  const hasTranscript  = !!visit.transcript
  const hasNotes       = !!visit.text_notes
  const showSourcePane = debrief && (hasTranscript || hasNotes) && citations.length > 0

  // Active sentence indices for each pane
  const transcriptSentences = activeCitation?.source === 'transcript' ? activeCitation.sentence_indices : []
  const notesSentences      = activeCitation?.source === 'notes'      ? activeCitation.sentence_indices : []

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '40rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

        {/* ── Header card ── */}
        <div style={{
          background:  C.surface,
          border:      `1px solid ${C.border}`,
          borderLeft:  isEscalate ? '4px solid #EF4444' : undefined,
          borderRadius: '1rem',
          padding:     '1.25rem',
          display:     'flex',
          justifyContent: 'space-between',
          alignItems:  'flex-start',
        }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text }}>{visit.locations.name}</h1>
            <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: C.muted }}>
              {visit.locations.district} · {new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {visit.program_area}
            </p>
          </div>
          {flagStyle && flag && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
              borderRadius: '99px', background: flagStyle.bg, color: flagStyle.color,
            }}>
              {isEscalate && '⚠ '}{flag}
            </span>
          )}
        </div>

        {/* ── Pending ── */}
        {status === 'pending' && (
          <div role="status" aria-live="polite" style={{
            background: '#FAE8DF', border: '1px solid #F4BFA3',
            borderRadius: '1rem', padding: '1rem 1.1rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0, animation: 'pulse 1.5s infinite', display: 'inline-block' }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#7C2D12' }}>AI debrief generating…</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.15rem', color: '#92400E' }}>Usually ready in under 20 seconds. Your visit is saved.</p>
            </div>
          </div>
        )}

        {/* ── Failed ── */}
        {status === 'failed' && (
          <div role="alert" style={{
            background: '#FEE2E2', border: '1px solid #FECACA',
            borderRadius: '1rem', padding: '1rem 1.1rem',
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#7F1D1D' }}>AI summary couldn't be generated</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.15rem', color: '#991B1B' }}>Your visit notes are saved and visible to your manager.</p>
          </div>
        )}

        {/* ── Done ── */}
        {status === 'done' && debrief && (
          <>
            {/* Summary */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.1rem' }}>
              <SectionLabel>Summary</SectionLabel>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: C.text }}>{debrief.summary}</p>
              <div style={{ marginTop: '0.75rem' }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 500, padding: '0.25rem 0.75rem',
                  borderRadius: '99px', ...SENTIMENT[debrief.community_sentiment],
                }}>
                  {SENTIMENT[debrief.community_sentiment].label}
                </span>
              </div>
            </div>

            {/* Source pane — transcript / notes with sentence highlighting */}
            {showSourcePane && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: '1rem', padding: '1.1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <SectionLabel>Source text</SectionLabel>
                  {hasTranscript && hasNotes && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {(['transcript', 'notes'] as const).map(tab => (
                        <button key={tab} onClick={() => setSourceTab(tab)}
                          style={{
                            fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.65rem',
                            borderRadius: '99px', border: 'none', cursor: 'pointer',
                            background: sourceTab === tab ? C.accent : C.borderAlt,
                            color:      sourceTab === tab ? '#FDFAF5' : C.muted,
                            transition: 'background 0.15s, color 0.15s',
                          }}>
                          {tab === 'transcript' ? 'Voice transcript' : 'Text notes'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!activeKey && (
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: '0.6rem', fontStyle: 'italic' }}>
                    Hover a finding or blocker below to highlight its source sentence here
                  </p>
                )}

                {sourceTab === 'transcript' && (
                  <SourcePanel
                    text={visit.transcript}
                    label="Voice transcript"
                    activeSentences={transcriptSentences}
                  />
                )}
                {sourceTab === 'notes' && (
                  <SourcePanel
                    text={visit.text_notes}
                    label="Officer notes"
                    activeSentences={notesSentences}
                  />
                )}
              </div>
            )}

            {/* Key findings */}
            <CitableSection
              label="Key Findings" field="key_findings"
              items={debrief.key_findings} citations={citations}
              activeKey={activeKey} onActivate={handleActivate} onDeactivate={handleDeactivate}
              bullet={() => <span style={{ color: C.accent }}>·</span>}
              color={C.text}
              cardStyle={{ background: C.surface, border: `1px solid ${C.border}` }}
            />

            {/* Blockers */}
            <CitableSection
              label="Blockers" field="blockers"
              items={debrief.blockers} citations={citations}
              activeKey={activeKey} onActivate={handleActivate} onDeactivate={handleDeactivate}
              bullet={() => <span>✕</span>}
              color="#7F1D1D"
              cardStyle={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
            />

            {/* Follow-ups */}
            <CitableSection
              label="Follow-ups" field="follow_ups"
              items={debrief.follow_ups} citations={citations}
              activeKey={activeKey} onActivate={handleActivate} onDeactivate={handleDeactivate}
              bullet={() => <span style={{ color: '#2D4A3E' }}>→</span>}
              color={C.text}
              cardStyle={{ background: C.surface, border: `1px solid ${C.border}` }}
            />

            {/* Recurring issues */}
            <CitableSection
              label="Recurring Issues" field="recurring_issues"
              items={debrief.recurring_issues} citations={citations}
              activeKey={activeKey} onActivate={handleActivate} onDeactivate={handleDeactivate}
              bullet={() => <span>⚠</span>}
              color="#78350F"
              cardStyle={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
            />

            {/* Officer note */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <SectionLabel>Your Note</SectionLabel>
              {debrief.officer_note && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: C.dark }}>{debrief.officer_note}</p>
                </div>
              )}
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Add a note to this debrief…"
                style={{
                  width: '100%', border: `1px solid ${C.border}`, borderRadius: '0.75rem',
                  padding: '0.625rem 0.75rem', fontSize: '0.875rem', background: C.surface,
                  color: C.text, resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleNoteSubmit} disabled={savingNote || !note.trim()}
                style={{
                  background: '#2D4A3E', color: '#FDFAF5', border: 'none',
                  borderRadius: '0.75rem', padding: '0.5rem 1rem',
                  fontSize: '0.875rem', fontWeight: 500,
                  opacity: (savingNote || !note.trim()) ? 0.5 : 1,
                  cursor: (savingNote || !note.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {savingNote ? 'Saving…' : 'Add note'}
              </button>
            </div>
          </>
        )}

        <div style={{ paddingTop: '0.5rem' }}>
          <a href="/visits" style={{ fontSize: '0.875rem', fontWeight: 500, color: C.accent, textDecoration: 'none' }}>
            ← Back to My Visits
          </a>
        </div>
      </div>
    </div>
  )
}