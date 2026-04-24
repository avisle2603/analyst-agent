import React, { useState } from 'react'
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

function SectionHeader({ title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '16px', paddingBottom: '10px',
      borderBottom: '1px solid #2d3748',
    }}>
      <span style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', letterSpacing: '-0.01em' }}>
        {title}
      </span>
    </div>
  )
}

function renderBulletText(text) {
  if (!text) return null
  const clean = stripMd(text)
  const lines = clean.split(/\n+/).filter(l => l.trim().length > 5)
  if (lines.length <= 1) {
    const sentences = clean.split(/\.\s+/).filter(s => s.trim().length > 10)
    return (
      <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
        {sentences.map((s, i) => (
          <li key={i} style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start',
            padding: '6px 0',
            borderBottom: i < sentences.length - 1 ? '1px solid #1e2535' : 'none',
            fontSize: '14px', lineHeight: '1.7', color: '#cbd5e1',
          }}>
            <span style={{ color: '#1D9E75', marginTop: '2px', flexShrink: 0, fontSize: '16px' }}>→</span>
            <span>{s.trim()}{s.endsWith('.') ? '' : '.'}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
      {lines.map((line, i) => (
        <li key={i} style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          padding: '8px 0',
          borderBottom: i < lines.length - 1 ? '1px solid #1e2535' : 'none',
          fontSize: '14px', lineHeight: '1.7', color: '#cbd5e1',
        }}>
          <span style={{ color: '#1D9E75', marginTop: '2px', flexShrink: 0, fontSize: '16px' }}>→</span>
          <span>{stripMd(line.trim())}</span>
        </li>
      ))}
    </ul>
  )
}

function parsePortfolioTable(text) {
  if (!text) return { headers: [], rows: [] }
  const lines = text.split('\n').filter(l => l.includes('|'))
  const dataLines = lines.filter(l => !/^[\s|:-]+$/.test(l))
  if (dataLines.length < 2) return { headers: [], rows: [] }
  const headers = dataLines[0].split('|').map(c => stripMd(c.trim())).filter(Boolean)
  const rows = dataLines.slice(1).map(r =>
    r.split('|').map(c => stripMd(c.trim())).filter(Boolean)
  )
  return { headers, rows }
}

function renderSectionContent(text) {
  const { headers, rows } = parsePortfolioTable(text)
  if (headers.length > 0 && rows.length > 0) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  color: '#64748b', fontSize: '12px', textTransform: 'uppercase',
                  letterSpacing: '0.05em', padding: '6px 0', fontWeight: '600',
                  textAlign: i === 0 ? 'left' : 'right',
                  borderBottom: '1px solid #2d3748',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{
                borderBottom: i < rows.length - 1 ? '1px solid #1e2535' : 'none',
                background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    color: j === 0 ? '#e2e8f0' : '#94a3b8',
                    fontSize: j === 0 ? '14px' : '14px',
                    fontFamily: j > 0 ? 'monospace' : 'inherit',
                    fontWeight: j === 0 ? '500' : '400',
                    padding: '12px 0',
                    textAlign: j === 0 ? 'left' : 'right',
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return renderBulletText(text)
}

function renderPortfolioResult(result) {
  if (!result) return null
  const hashParts = result.split(/^## /m).filter(Boolean)
  if (hashParts.length > 1) {
    return hashParts.map((p, i) => {
      const lines = p.split('\n')
      const title = lines[0].trim().replace(/[^a-zA-Z0-9\s]/g, '').trim()
      const content = lines.slice(1).join('\n').trim()
      return (
        <div key={i} style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '16px', fontWeight: '600', color: '#e2e8f0',
            letterSpacing: '-0.01em', marginBottom: '12px',
            paddingBottom: '10px', borderBottom: '1px solid #2d3748',
          }}>
            {title}
          </div>
          {renderSectionContent(content)}
        </div>
      )
    })
  }
  return renderBulletText(result)
}

const S = {
  page: {
    padding: '28px', minHeight: '100vh',
    background: '#0f1117', color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px 24px',
    marginBottom: '16px',
  },
  btn: {
    background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '12px 24px', fontSize: '13px',
    fontWeight: '500', cursor: 'pointer', marginTop: '12px',
  },
  chip: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '8px', padding: '12px 16px',
    fontSize: '14px', color: '#94a3b8',
    cursor: 'pointer', display: 'block',
    marginBottom: '8px', width: '100%', textAlign: 'left',
  },
  textarea: {
    width: '100%', background: '#0f1117',
    border: '1px solid #2d3748', borderRadius: '8px',
    color: '#e2e8f0', padding: '12px', fontSize: '14px',
    fontFamily: 'monospace', resize: 'vertical',
    minHeight: '100px', outline: 'none', boxSizing: 'border-box',
  },
}

const EXAMPLES = [
  'SCHD 40%, SGOV 30%, VNQ 30%',
  'AAPL 25%, MSFT 25%, NVDA 25%, AMZN 25%',
  'VTI 60%, BND 30%, GLD 10%',
]

export default function Portfolio() {
  const [holdings,    setHoldings]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [downloading, setDownloading] = useState(false)

  const analyze = async () => {
    if (!holdings.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await axios.post('http://localhost:8000/analyze', {
        query: 'Portfolio risk analysis: ' + holdings,
      })
      setResult(res.data.result || res.data.brief || '')
    } catch {
      setResult('Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const download = async () => {
    try {
      setDownloading(true)
      const res = await axios.post(
        'http://localhost:8000/export/docx',
        { query: 'Portfolio risk analysis: ' + holdings },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `portfolio_report_${Date.now()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '24px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' }}>
          Portfolio Risk Check
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.6' }}>
          Enter your holdings with weights to analyze concentration and sector risk.
        </div>
        <textarea
          style={S.textarea}
          placeholder="e.g. SCHD 40%, SGOV 30%, VNQ 30%"
          value={holdings}
          onChange={e => setHoldings(e.target.value)}
        />
        <button style={S.btn} onClick={analyze} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Portfolio →'}
        </button>
      </div>

      {!result && !loading && (
        <div style={S.card}>
          <SectionHeader title="Quick Examples" />
          {EXAMPLES.map((ex, i) => (
            <button key={i} style={S.chip} onClick={() => setHoldings(ex)}>{ex}</button>
          ))}
        </div>
      )}

      {loading && (
        <div style={S.card}>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Running portfolio analysis...
          </p>
        </div>
      )}

      {result && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <SectionHeader title="Portfolio Analysis" />
            <button
              style={{
                background: 'transparent', color: '#1D9E75',
                border: '1px solid #1D9E75', borderRadius: '8px',
                padding: '8px 16px', fontSize: '13px',
                cursor: 'pointer', fontWeight: '500', flexShrink: 0,
                marginLeft: '16px', marginTop: '-16px',
              }}
              onClick={download}
              disabled={downloading}
            >
              {downloading ? 'Generating...' : '↓ Download Report'}
            </button>
          </div>
          {renderPortfolioResult(result)}
        </div>
      )}
    </div>
  )
}
