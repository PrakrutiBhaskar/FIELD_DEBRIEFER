'use client'

import { useEffect, useState, useCallback } from 'react'
import { SkeletonPage } from '@/components/skeleton'

// ─── Types (mirrors API response) ────────────────────────────────────────────

type IssueCount = { issue: string; count: number; pct: number }

type GroupSummary = {
  district: string
  program_area: string
  visit_count: number
  escalate_count: number
  sentiment_counts: { Positive: number; Mixed: number; Negative: number }
  top_issues: IssueCount[]
  top_blockers: IssueCount[]
  narrative: string
  visit_ids: string[]
}

type PatternsResponse = {
  generated_at: string
  total_visits: number
  groups: GroupSummary[]
}

// ─── Design tokens (matches rest of app) ─────────────────────────────────────

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

const PROGRAM_COLORS: Record<string, { bg: string; color: string }> = {
  'Rural Livelihoods':  { bg: '#E2EDE9', color: '#2D4A3E' },
  'Agriculture':        { bg: '#DCFCE7', color: '#166534' },
  'Skilling':           { bg: '#EEF2FF', color: '#3730A3' },
  'Economic Inclusion': { bg: '#FEF9C3', color: '#713F12' },
  'Other':              { bg: '#F3F4F6', color: '#374151' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FrequencyBar({ item, max }: { item: IssueCount; max: number }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <span style={{ fontSize: '0.8rem', color: C.dark, flex: 1, paddingRight: '0.5rem' }}>
          {item.issue}
        </span>
        <span style={{ fontSize: '0.75rem', color: C.muted, whiteSpace: 'nowrap' }}>
          {item.count}× · {item.pct}%
        </span>
      </div>
      <div style={{ height: '5px', background: C.borderAlt, borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(item.count / max) * 100}%`,
          background: C.accent,
          borderRadius: '99px',
          transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  )
}

function SentimentDots({ counts }: { counts: { Positive: number; Mixed: number; Negative: number } }) {
  const total = counts.Positive + counts.Mixed + counts.Negative
  if (total === 0) return null
  const items = [
    { label: 'Positive', color: '#22C55E', count: counts.Positive },
    { label: 'Mixed',    color: '#EAB308', count: counts.Mixed },
    { label: 'Negative', color: '#EF4444', count: counts.Negative },
  ]
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {items.filter(i => i.count > 0).map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: i.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: C.muted }}>{i.label}: {i.count}</span>
        </div>
      ))}
    </div>
  )
}

function EscalateBadge({ count, total }: { count: number; total: number }) {
  if (count === 0) return null
  const urgent = count / total >= 0.3
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
      borderRadius: '99px',
      background: urgent ? '#FEE2E2' : '#FEF3C7',
      color:      urgent ? '#991B1B' : '#92400E',
    }}>
      ⚠ {count} escalate{count !== 1 ? 's' : ''}
    </span>
  )
}

function GroupCard({ group }: { group: GroupSummary }) {
  const [open, setOpen] = useState(false)
  const progStyle = PROGRAM_COLORS[group.program_area] ?? PROGRAM_COLORS['Other']
  const maxIssue   = group.top_issues[0]?.count  ?? 1
  const maxBlocker = group.top_blockers[0]?.count ?? 1
  const isUrgent   = group.escalate_count / group.visit_count >= 0.3

  return (
    <div style={{
      background:   C.surface,
      border:       `1px solid ${isUrgent ? '#FECACA' : C.border}`,
      borderLeft:   isUrgent ? `4px solid #EF4444` : `1px solid ${C.border}`,
      borderRadius: '1rem',
      overflow:     'hidden',
      transition:   'box-shadow 0.15s',
    }}>
      {/* ── Header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '1.25rem',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.text }}>{group.district}</span>
            <span style={{ fontSize: '0.75rem', color: C.muted }}>·</span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem',
              borderRadius: '99px', ...progStyle,
            }}>
              {group.program_area}
            </span>
            <EscalateBadge count={group.escalate_count} total={group.visit_count} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: C.muted }}>
              <b style={{ color: C.text }}>{group.visit_count}</b> visits
            </span>
            {group.top_issues[0] && (
              <span style={{ fontSize: '0.78rem', color: C.muted }}>
                Top issue: <b style={{ color: C.dark }}>{group.top_issues[0].issue}</b> ({group.top_issues[0].count}×)
              </span>
            )}
            {group.top_blockers[0] && (
              <span style={{ fontSize: '0.78rem', color: C.muted }}>
                Top blocker: <b style={{ color: C.dark }}>{group.top_blockers[0].issue}</b> ({group.top_blockers[0].count}×)
              </span>
            )}
          </div>

          <SentimentDots counts={group.sentiment_counts} />
        </div>

        {/* Chevron */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginTop: '0.15rem' }}>
          <path d="M4 6L8 10L12 6" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${C.borderAlt}` }}>

          {/* AI narrative */}
          <div style={{
            background: '#F9F5EF', border: `1px solid ${C.borderAlt}`,
            borderRadius: '0.75rem', padding: '1rem', margin: '1rem 0',
          }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Pattern Narrative
            </p>
            <p style={{ fontSize: '0.875rem', color: C.dark, lineHeight: 1.65 }}>{group.narrative}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

            {/* Recurring issues */}
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Recurring Issues
              </p>
              {group.top_issues.length === 0
                ? <p style={{ fontSize: '0.8rem', color: C.muted }}>None identified</p>
                : group.top_issues.map(item => (
                    <FrequencyBar key={item.issue} item={item} max={maxIssue} />
                  ))
              }
            </div>

            {/* Blockers */}
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Blockers
              </p>
              {group.top_blockers.length === 0
                ? <p style={{ fontSize: '0.8rem', color: C.muted }}>None reported</p>
                : group.top_blockers.map(item => (
                    <FrequencyBar key={item.issue} item={item} max={maxBlocker} />
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function FilterBar({
  groups, districtFilter, programFilter,
  onDistrict, onProgram,
}: {
  groups: GroupSummary[]
  districtFilter: string; programFilter: string
  onDistrict: (v: string) => void; onProgram: (v: string) => void
}) {
  const districts = [...new Set(groups.map(g => g.district))].sort()
  const programs  = [...new Set(groups.map(g => g.program_area))].sort()

  const sel: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: '0.75rem',
    padding: '0.45rem 0.75rem', fontSize: '0.85rem',
    background: C.surface, color: C.text, outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <select value={districtFilter} onChange={e => onDistrict(e.target.value)} style={sel}>
        <option value="">All districts</option>
        {districts.map(d => <option key={d}>{d}</option>)}
      </select>
      <select value={programFilter} onChange={e => onProgram(e.target.value)} style={sel}>
        <option value="">All programs</option>
        {programs.map(p => <option key={p}>{p}</option>)}
      </select>
      {(districtFilter || programFilter) && (
        <button onClick={() => { onDistrict(''); onProgram('') }}
          style={{ fontSize: '0.8rem', color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
          Clear filters
        </button>
      )}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ data }: { data: PatternsResponse }) {
  const totalEscalates = data.groups.reduce((s, g) => s + g.escalate_count, 0)
  const allIssues      = data.groups.flatMap(g => g.top_issues)
  const topGlobal      = allIssues.reduce<Record<string, number>>((acc, i) => {
    acc[i.issue] = (acc[i.issue] ?? 0) + i.count; return acc
  }, {})
  const topIssueName   = Object.entries(topGlobal).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const genAt          = new Date(data.generated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const tile = (val: string | number, label: string, urgent?: boolean): React.ReactNode => (
    <div style={{
      background: C.surface, border: `1px solid ${urgent ? '#FECACA' : C.border}`,
      borderRadius: '0.875rem', padding: '0.9rem 1.1rem', flex: '1 1 120px', minWidth: '100px',
    }}>
      <p style={{ fontSize: '1.35rem', fontWeight: 700, color: urgent ? '#991B1B' : C.text, lineHeight: 1 }}>{val}</p>
      <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.3rem' }}>{label}</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {tile(data.total_visits,      'visits analysed (90d)')}
        {tile(data.groups.length,     'district × program groups')}
        {tile(totalEscalates,         'escalation flags', totalEscalates > 0)}
        {tile(topIssueName,           'most common issue')}
      </div>
      <p style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '1.25rem' }}>
        Auto-refreshed · last generated {genAt}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatternsDashboard() {
  const [data, setData]       = useState<PatternsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [district, setDistrict] = useState('')
  const [program, setProgram]   = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/v1/patterns')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error.message ?? d.error.code)
        setData(d)
      })
      .catch(e => setError(e.message ?? 'Failed to load pattern data.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data?.groups.filter(g => {
    if (district && g.district !== district) return false
    if (program  && g.program_area !== program) return false
    return true
  }) ?? []

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: C.text, marginBottom: '0.2rem' }}>
              Pattern Dashboard
            </h1>
            <p style={{ fontSize: '0.82rem', color: C.muted }}>
              Auto-grouped recurring issues · last 90 days · no manual selection needed
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: loading ? C.borderAlt : C.accent,
              color: loading ? C.muted : '#FDFAF5',
              border: 'none', borderRadius: '0.75rem',
              padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
            }}
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: '#FEE2E2', border: '1px solid #FECACA',
            borderRadius: '0.75rem', padding: '0.85rem 1rem',
            fontSize: '0.85rem', color: '#991B1B', marginBottom: '1.25rem',
          }}>
            {error}
            <button onClick={load} style={{ marginLeft: '0.75rem', fontWeight: 600, background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {loading && <SkeletonPage />}

        {!loading && data && (
          <>
            <SummaryStrip data={data} />

            {data.groups.length > 0 && (
              <FilterBar
                groups={data.groups}
                districtFilter={district} programFilter={program}
                onDistrict={setDistrict} onProgram={setProgram}
              />
            )}

            {filtered.length === 0 && !error && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: '1rem', padding: '2.5rem 1.5rem', textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.95rem', color: C.muted }}>
                  {data.groups.length === 0
                    ? 'No completed debriefs in the last 90 days yet.'
                    : 'No groups match the selected filters.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filtered.map(g => (
                <GroupCard key={`${g.district}||${g.program_area}`} group={g} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}