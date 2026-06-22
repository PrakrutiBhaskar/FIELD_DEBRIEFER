'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

type ExportButtonsProps = {
  visitIds?: string[]
  reportText?: string
  dateRange?: { from: string; to: string }
  filterContext?: Record<string, string>
  totalVisits: number
}

export default function ExportButtons({
  visitIds,
  reportText,
  dateRange,
  filterContext,
  totalVisits,
}: ExportButtonsProps) {
  const [exportingCSV, setExportingCSV] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (format === 'csv') setExportingCSV(true)
    else setExportingPDF(true)

    try {
      const res = await fetch('/api/v1/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          visit_ids: visitIds,
          report_text: reportText,
          date_range: dateRange,
          filter_context: filterContext,
        }),
      })

      if (!res.ok) {
        toast('Export failed. Please try again.', 'error')
        return
      }

      if (format === 'csv') {
        // Download CSV file
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `field-visits-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast('CSV downloaded successfully')
      } else {
        // Open PDF in new tab for print-to-PDF
        const html = await res.text()
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const win = window.open(url, '_blank')
        if (!win) {
          toast('Please allow popups to open the PDF preview', 'error')
        } else {
          toast('PDF preview opened — use Save as PDF to download')
        }
      }
    } catch {
      toast('Export failed. Please try again.', 'error')
    } finally {
      setExportingCSV(false)
      setExportingPDF(false)
    }
  }

  if (totalVisits === 0) return null

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#6B7C74' }}>Export:</span>
      <button
        onClick={() => handleExport('csv')}
        disabled={exportingCSV}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px',
          border: '1px solid #DDD6C8', background: '#FDFAF5',
          fontSize: '12px', fontWeight: 500, color: '#1E2A22',
          cursor: exportingCSV ? 'not-allowed' : 'pointer',
          opacity: exportingCSV ? 0.6 : 1,
          transition: 'all 0.15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v8M3 6.5l3.5 3.5 3.5-3.5M1 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {exportingCSV ? 'Exporting…' : 'CSV'}
      </button>
      <button
        onClick={() => handleExport('pdf')}
        disabled={exportingPDF}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px',
          border: '1px solid #DDD6C8', background: '#FDFAF5',
          fontSize: '12px', fontWeight: 500, color: '#1E2A22',
          cursor: exportingPDF ? 'not-allowed' : 'pointer',
          opacity: exportingPDF ? 0.6 : 1,
          transition: 'all 0.15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 3h9M2 6.5h7M2 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {exportingPDF ? 'Generating…' : 'PDF Report'}
      </button>
    </div>
  )
}