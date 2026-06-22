import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await request.json()
  const { format, visit_ids, report_text, date_range, filter_context } = body

  if (!['csv', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use csv or pdf.' }, { status: 400 })
  }

  let query = supabase
    .from('visits')
    .select(`
      id, visit_date, program_area, created_at,
      locations(name, district, state),
      profiles(full_name),
      debriefs(
        summary, nudge_flag, community_sentiment,
        key_findings, blockers, follow_ups, recurring_issues, officer_note
      )
    `)
    .eq('debrief_status', 'done')
    .order('visit_date', { ascending: false })

  if (visit_ids && visit_ids.length > 0) {
    query = query.in('id', visit_ids)
  }

  const { data: visits, error } = await query.limit(200)

  if (error || !visits) {
    console.error('Export fetch error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 })
  }

  if (format === 'csv') {
    const csv = generateCSV(visits as Record<string, any>[])
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="field-visits-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  const html = generatePDFHTML({
    visits: visits as Record<string, any>[],
    report_text,
    date_range,
    filter_context,
    exported_by: profile.full_name,
    exported_at: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function generateCSV(visits: Record<string, any>[]): string {
  const headers = [
    'Visit Date', 'Location', 'District', 'State', 'Program Area', 'Officer',
    'Nudge Flag', 'Community Sentiment', 'Summary', 'Key Findings',
    'Blockers', 'Follow-ups', 'Recurring Issues', 'Officer Note',
  ]

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = Array.isArray(val) ? val.join(' | ') : String(val)
    return `"${str.replace(/"/g, '""')}"`
  }

  const rows = visits.map(v => [
    escape(v.visit_date),
    escape(v.locations?.name),
    escape(v.locations?.district),
    escape(v.locations?.state || 'Karnataka'),
    escape(v.program_area),
    escape(v.profiles?.full_name),
    escape(v.debriefs?.nudge_flag),
    escape(v.debriefs?.community_sentiment),
    escape(v.debriefs?.summary),
    escape(v.debriefs?.key_findings),
    escape(v.debriefs?.blockers),
    escape(v.debriefs?.follow_ups),
    escape(v.debriefs?.recurring_issues),
    escape(v.debriefs?.officer_note),
  ])

  return [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n')
}

function generatePDFHTML({
  visits, report_text, date_range, filter_context, exported_by, exported_at,
}: {
  visits: Record<string, any>[]
  report_text?: string
  date_range?: { from: string; to: string }
  filter_context?: Record<string, string>
  exported_by: string
  exported_at: string
}): string {
  const totalVisits = visits.length
  const escalateCount = visits.filter(v => v.debriefs?.nudge_flag === 'Escalate').length
  const attentionCount = visits.filter(v => v.debriefs?.nudge_flag === 'Needs Attention').length
  const routineCount = visits.filter(v => v.debriefs?.nudge_flag === 'Routine').length
  const positiveCount = visits.filter(v => v.debriefs?.community_sentiment === 'Positive').length
  const negativeCount = visits.filter(v => v.debriefs?.community_sentiment === 'Negative').length
  const mixedCount = totalVisits - positiveCount - negativeCount

  const districtCounts: Record<string, number> = visits.reduce((acc, v) => {
    const d = v.locations?.district || 'Unknown'
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const blockerCounts = new Map<string, number>()
  for (const v of visits) {
    for (const b of (v.debriefs?.blockers || [])) {
      const key = (b as string).toLowerCase().trim()
      blockerCounts.set(key, (blockerCounts.get(key) || 0) + 1)
    }
  }

  const topBlockers: [string, number][] = Array.from(blockerCounts.entries())
    .map(([k, v]) => [k, v] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const maxBlockerCount = topBlockers.length > 0 ? topBlockers[0][1] : 1

  const dateLabel = date_range
    ? `${date_range.from} to ${date_range.to}`
    : 'All available data'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Field Intelligence Report — The/Nudge Foundation</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #F5F0E8; color: #1C1917; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #C2603A; }
    .org-name { font-size: 13px; font-weight: 600; color: #C2603A; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
    .report-title { font-size: 26px; font-weight: 700; color: #1C1917; letter-spacing: -0.02em; line-height: 1.2; }
    .meta { font-size: 12px; color: #78716C; margin-top: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
    .stat-card { background: white; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #E2DDD6; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #78716C; margin-top: 4px; font-weight: 500; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #78716C; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E2DDD6; }
    .report-box { background: white; border-radius: 12px; padding: 24px; border: 1px solid #E2DDD6; border-left: 4px solid #C2603A; }
    .report-box p { font-size: 14px; line-height: 1.8; color: #292524; white-space: pre-wrap; }
    .blocker-list { background: white; border-radius: 12px; padding: 16px; border: 1px solid #E2DDD6; }
    .blocker-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F5F0E8; font-size: 13px; }
    .blocker-item:last-child { border-bottom: none; }
    .blocker-bar-wrap { flex: 1; margin: 0 12px; height: 4px; background: #F5F0E8; border-radius: 99px; }
    .blocker-bar { height: 4px; background: #C2603A; border-radius: 99px; }
    .blocker-count { font-size: 12px; font-weight: 600; color: #C2603A; min-width: 24px; text-align: right; }
    .district-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .district-card { background: white; border-radius: 10px; padding: 14px 16px; border: 1px solid #E2DDD6; display: flex; justify-content: space-between; align-items: center; }
    .district-name { font-size: 13px; font-weight: 500; }
    .district-count { font-size: 12px; color: #78716C; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 10px 12px; background: #1C1917; color: white; font-weight: 500; font-size: 11px; letter-spacing: 0.04em; }
    th:first-child { border-radius: 8px 0 0 0; }
    th:last-child { border-radius: 0 8px 0 0; }
    td { padding: 10px 12px; border-bottom: 1px solid #F5F0E8; color: #292524; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #FAFAF8; }
    .flag-escalate { color: #991B1B; font-weight: 600; }
    .flag-needs-attention { color: #B45309; font-weight: 500; }
    .flag-routine { color: #2D5016; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E2DDD6; display: flex; justify-content: space-between; font-size: 11px; color: #A8A29E; }
    .print-bar { background: #1C1917; color: white; padding: 14px 40px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .print-btn { background: #C2603A; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'Inter', sans-serif; }
    .print-btn:hover { opacity: 0.9; }
    .close-btn { background: #44403C; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'Inter', sans-serif; }
    @media print { body { background: white; } .page { padding: 24px; } .print-bar { display: none; } }
  </style>
</head>
<body>

<div class="print-bar">
  <span style="font-size: 13px; font-weight: 500;">Field Intelligence Report — The/Nudge Foundation</span>
  <div style="display: flex; gap: 10px;">
    <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>
</div>

<div class="page">

  <div class="header">
    <div>
      <p class="org-name">The/Nudge Foundation</p>
      <h1 class="report-title">Field Intelligence Report</h1>
      <p class="meta">Period: ${dateLabel}${filter_context?.program_area ? ` · ${filter_context.program_area}` : ''}${filter_context?.location ? ` · ${filter_context.location}` : ''}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 12px; color: #78716C;">Exported by</p>
      <p style="font-size: 14px; font-weight: 500; color: #1C1917;">${exported_by}</p>
      <p style="font-size: 12px; color: #78716C; margin-top: 2px;">${exported_at}</p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value" style="color:#1C1917">${totalVisits}</div><div class="stat-label">Total visits</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#991B1B">${escalateCount}</div><div class="stat-label">Escalate</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#B45309">${attentionCount}</div><div class="stat-label">Needs attention</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#2D5016">${routineCount}</div><div class="stat-label">Routine</div></div>
  </div>

  <div class="section">
    <p class="section-title">Community Sentiment</p>
    <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2DDD6;">
      <div style="display:flex;gap:24px;margin-bottom:12px;">
        <span style="font-size:13px;color:#166534;">↑ Positive: ${positiveCount}</span>
        <span style="font-size:13px;color:#B45309;">→ Mixed: ${mixedCount}</span>
        <span style="font-size:13px;color:#991B1B;">↓ Negative: ${negativeCount}</span>
      </div>
      <div style="display:flex;height:8px;border-radius:99px;overflow:hidden;gap:2px;">
        ${positiveCount > 0 ? `<div style="flex:${positiveCount};background:#86EFAC;"></div>` : ''}
        ${mixedCount > 0 ? `<div style="flex:${mixedCount};background:#FDE68A;"></div>` : ''}
        ${negativeCount > 0 ? `<div style="flex:${negativeCount};background:#FCA5A5;"></div>` : ''}
      </div>
    </div>
  </div>

  ${report_text ? `
  <div class="section">
    <p class="section-title">AI Intelligence Analysis</p>
    <div class="report-box"><p>${report_text}</p></div>
  </div>` : ''}

  ${topBlockers.length > 0 ? `
  <div class="section">
    <p class="section-title">Top Recurring Blockers</p>
    <div class="blocker-list">
      ${topBlockers.map(([blocker, count]) => `
        <div class="blocker-item">
          <span style="flex:2;color:#292524;">${blocker.charAt(0).toUpperCase() + blocker.slice(1)}</span>
          <div class="blocker-bar-wrap">
            <div class="blocker-bar" style="width:${Math.round(count / maxBlockerCount * 100)}%;"></div>
          </div>
          <span class="blocker-count">${count}×</span>
        </div>`).join('')}
    </div>
  </div>` : ''}

  ${Object.keys(districtCounts).length > 0 ? `
  <div class="section">
    <p class="section-title">District Coverage</p>
    <div class="district-grid">
      ${Object.entries(districtCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([district, count]) => `
        <div class="district-card">
          <span class="district-name">${district}</span>
          <span class="district-count">${count} visit${count !== 1 ? 's' : ''}</span>
        </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="section">
    <p class="section-title">Visit Details (${visits.length})</p>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Location</th><th>Program</th><th>Officer</th><th>Flag</th><th>Summary</th>
        </tr>
      </thead>
      <tbody>
        ${visits.slice(0, 50).map(v => {
          const flagClass = v.debriefs?.nudge_flag === 'Escalate'
            ? 'flag-escalate'
            : v.debriefs?.nudge_flag === 'Needs Attention'
            ? 'flag-needs-attention'
            : 'flag-routine'
          const summary = v.debriefs?.summary || '—'
          return `<tr>
            <td style="white-space:nowrap;">${new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td>${v.locations?.name || '—'}<br><span style="color:#78716C;font-size:11px;">${v.locations?.district || ''}</span></td>
            <td>${v.program_area}</td>
            <td>${v.profiles?.full_name || '—'}</td>
            <td class="${flagClass}">${v.debriefs?.nudge_flag || '—'}</td>
            <td style="max-width:200px;">${summary.length > 120 ? summary.slice(0, 120) + '…' : summary}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    ${visits.length > 50 ? `<p style="font-size:11px;color:#78716C;margin-top:8px;">Showing 50 of ${visits.length} visits. Export CSV for full data.</p>` : ''}
  </div>

  <div class="footer">
    <span>Field Visit Debrief Tool · The/Nudge Foundation</span>
    <span>Confidential — For internal use and authorised funder reporting only</span>
  </div>

</div>
</body>
</html>`
}