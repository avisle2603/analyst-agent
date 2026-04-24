import React, { useState, useEffect } from 'react'
import axios from 'axios'

function stripMd(t) {
  if (!t) return ''
  return t
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^\s*[-*]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\|[\s:-]+\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/---+/g, '')
    .replace(/===+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderExpandedBrief(brief) {
  if (!brief) return null
  const hashParts = brief.split(/^## /m).filter(Boolean)
  if (hashParts.length > 1) {
    return hashParts.map((p, i) => {
      const lines = p.split('\n')
      const title = lines[0].trim().replace(/[^a-zA-Z0-9\s]/g, '').trim()
      const content = stripMd(lines.slice(1).join('\n').trim())
      if (!content) return null
      return (
        <div key={i} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>
            {title}
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
            {content}
          </p>
        </div>
      )
    })
  }
  return (
    <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
      {stripMd(brief)}
    </p>
  )
}

const S = {
  page: {
    padding: '28px', minHeight: '100vh',
    background: '#0f1117', color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  title: { fontSize: '24px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' },
  sub:   { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.6' },
  card: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px 24px', marginBottom: '12px',
  },
  query:    { fontSize: '16px', fontWeight: '500', color: '#e2e8f0', marginBottom: '4px' },
  time:     { fontSize: '13px', color: '#64748b', marginBottom: '14px' },
  row:      { display: 'flex', gap: '8px' },
  viewBtn: {
    background: 'transparent', color: '#94a3b8',
    border: '1px solid #2d3748', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
  },
  dlBtn: {
    background: 'transparent', color: '#1D9E75',
    border: '1px solid #1D9E75', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
  },
  clearBtn: {
    background: 'transparent', color: '#E24B4A',
    border: '1px solid #E24B4A', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px',
    cursor: 'pointer', marginBottom: '20px',
  },
  expanded: {
    marginTop: '16px', borderTop: '1px solid #2d3748', paddingTop: '16px',
  },
  empty: {
    color: '#64748b', fontSize: '15px',
    textAlign: 'center', padding: '60px 0',
  },
}

export default function Reports() {
  const [reports,     setReports]     = useState([])
  const [expanded,    setExpanded]    = useState(null)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('analyst_reports')
    if (saved) {
      try { setReports(JSON.parse(saved)) }
      catch { setReports([]) }
    }
  }, [])

  const clearAll = () => {
    localStorage.removeItem('analyst_reports')
    setReports([])
  }

  const download = async (report, i) => {
    try {
      setDownloading(i)
      const res = await axios.post(
        'http://localhost:8000/export/docx',
        { query: report.query },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${Date.now()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.title}>Reports</div>
      <div style={S.sub}>History of all analyses run this session.</div>

      {reports.length > 0 && (
        <button style={S.clearBtn} onClick={clearAll}>Clear All</button>
      )}

      {reports.length === 0 ? (
        <div style={S.empty}>
          No reports yet. Run an analysis from the Dashboard.
        </div>
      ) : (
        reports.map((r, i) => (
          <div key={i} style={S.card}>
            <div style={S.query}>{r.query}</div>
            <div style={S.time}>{r.timestamp}</div>
            <div style={S.row}>
              <button style={S.viewBtn} onClick={() => setExpanded(expanded === i ? null : i)}>
                {expanded === i ? 'Hide' : 'View'}
              </button>
              <button style={S.dlBtn} onClick={() => download(r, i)} disabled={downloading === i}>
                {downloading === i ? 'Generating...' : '↓ Download'}
              </button>
            </div>
            {expanded === i && (
              <div style={S.expanded}>
                {renderExpandedBrief(r.brief)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
