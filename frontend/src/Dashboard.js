import React, { useState, useEffect } from 'react'
import axios from 'axios'

const TOOLS = [
  'fetch_market_data', 'compute_kpis', 'scan_news',
  'detect_trends', 'benchmark_competitors',
  'check_portfolio_risk', 'calculate_upside',
]

function stripMd(text) {
  if (!text) return ''
  return text
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

function stripRiskEmoji(text) {
  return (text || '')
    .replace(/🔴/g, 'HIGH RISK — ')
    .replace(/🟡/g, 'MEDIUM RISK — ')
    .replace(/🟢/g, 'LOW RISK — ')
}

function parseNewsItems(text) {
  if (!text) return []
  return text.split('\n')
    .filter(l => l.trim().length > 12)
    .slice(0, 5)
    .map(l => ({
      headline: stripMd(l.replace(/^\d+[.)]\s*/, '')),
      sentiment: /positive|bullish/i.test(l) ? 'positive'
               : /negative|bearish/i.test(l) ? 'negative'
               : 'neutral',
    }))
}

function parseBrief(brief) {
  if (!brief) return {}

  const getSections = (text) => {
    const sections = {}
    const hashParts = text.split(/^## /m).filter(Boolean)
    if (hashParts.length > 1) {
      hashParts.forEach(p => {
        const lines = p.split('\n')
        const key = lines[0].trim().toLowerCase().replace(/[^a-z\s]/g, '').trim()
        sections[key] = lines.slice(1).join('\n').trim()
      })
      return sections
    }
    const numHeaders = [...text.matchAll(/^\d+\.\s+(.+)$/gm)]
    const numParts = text.split(/^\d+\.\s+/m).filter(Boolean)
    numParts.forEach((p, i) => {
      const header = numHeaders[i]
        ? numHeaders[i][1].toLowerCase().replace(/[^a-z\s]/g, '').trim()
        : `section${i}`
      sections[header] = p.trim()
    })
    return sections
  }

  const parseTable = (text) => {
    if (!text) return []
    const lines = text.split('\n').filter(l => l.includes('|'))
    return lines
      .filter(l => !/^[\s|:-]+$/.test(l))
      .map(r => r.split('|').map(c => c.trim()).filter(Boolean))
  }

  const parseKeyMetrics = (text) => {
    if (!text) return []
    const rows = parseTable(text)
    if (rows.length > 1) {
      return rows.slice(1)
        .map(r => ({ label: stripMd(r[0] || ''), value: stripMd(r[1] || '') }))
        .filter(r => r.label && r.value)
        .slice(0, 8)
    }
    return text.split('\n')
      .filter(l => l.includes(':'))
      .map(l => {
        const idx = l.indexOf(':')
        return {
          label: stripMd(l.substring(0, idx)).trim(),
          value: stripMd(l.substring(idx + 1)).trim(),
        }
      })
      .filter(r => r.label && r.value && r.label.length > 1)
      .slice(0, 8)
  }

  const parseCompetitors = (text) => {
    if (!text) return []
    const rows = parseTable(text)
    if (rows.length < 2) return []
    const headers = rows[0]
    return rows.slice(1).map(row => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = stripMd(row[i] || '—') })
      return obj
    })
  }

  const sections = getSections(brief)

  const get = (...keys) => {
    for (const k of keys) {
      for (const sk of Object.keys(sections)) {
        if (sk.includes(k)) return sections[sk]
      }
    }
    return ''
  }

  const priceMatch  = brief.match(/\$[\d,]+\.?\d*/)
  const peMatch     = brief.match(/P\/E[^:]*:?\s*([\d.]+)/i)
  const targetMatch = brief.match(/target[^:]*:?\s*\$?([\d,]+\.?\d*)/i)
  const upsideMatch = brief.match(/([+-]?\d+\.?\d*)%\s*(?:upside|below|above)/i)
  const signalMatch = brief.match(/\b(STRONG BUY|BUY|HOLD|SELL)\b/)
  const tickerM     = brief.match(/\(([A-Z]{2,5})\)/)
    || brief.match(/^#\s+[^\n]*?\b([A-Z]{2,5})\b/m)
  const ticker = tickerM
    ? tickerM[1]
    : (brief.match(/^([A-Z]{2,5})\b/) || [])[1] || ''

  const compText = get('competitor', 'benchmark', 'comparative', 'peer')

  return {
    ticker,
    price:             priceMatch  ? priceMatch[0]        : '—',
    pe:                peMatch     ? peMatch[1] + 'x'     : '—',
    target:            targetMatch ? '$' + targetMatch[1] : '—',
    upside:            upsideMatch ? upsideMatch[1] + '%' : '—',
    signal:            signalMatch ? signalMatch[1]       : 'HOLD',
    summary:           stripMd(get('summary', 'overview', 'executive')),
    keyMetrics:        parseKeyMetrics(get('key metric', 'metric', 'financial')),
    trend:             stripMd(get('trend', 'technical', 'momentum')),
    competitors:       parseCompetitors(compText),
    competitorHeaders: (() => { const rows = parseTable(compText); return rows.length > 0 ? rows[0].map(stripMd) : [] })(),
    newsItems:         parseNewsItems(get('news', 'sentiment', 'headlines')),
    risk:              stripMd(get('risk', 'concern', 'downside')),
    recommendation:    stripMd(get('recommendation', 'verdict', 'conclusion', 'action')),
    toolsCalled:       TOOLS,
  }
}

function saveReport(query, briefText) {
  try {
    const saved = localStorage.getItem('analyst_reports')
    const existing = saved ? JSON.parse(saved) : []
    const entry = { query, brief: briefText, timestamp: new Date().toLocaleString() }
    localStorage.setItem('analyst_reports', JSON.stringify([entry, ...existing.slice(0, 49)]))
  } catch {}
}

// ── Shared UI helpers ────────────────────────────────────────────

function badgeStyle(signal) {
  return {
    display: 'inline-block', padding: '6px 14px',
    borderRadius: '99px', fontSize: '14px', fontWeight: '600',
    background: signal === 'BUY' ? '#0f3d2a'
              : signal === 'SELL' ? '#3d0f0f' : '#3d2a0f',
    color: signal === 'BUY' ? '#1D9E75'
         : signal === 'SELL' ? '#E24B4A' : '#EF9F27',
  }
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

function renderRecommendation(text) {
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

// ── Styles ───────────────────────────────────────────────────────

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
  outlineBtn: {
    background: 'transparent', color: '#1D9E75',
    border: '1px solid #1D9E75', borderRadius: '8px',
    padding: '12px 24px', fontSize: '13px',
    fontWeight: '500', cursor: 'pointer',
  },
  primaryBtn: {
    background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '12px 24px', fontSize: '13px',
    fontWeight: '500', cursor: 'pointer',
  },
  chip: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '99px', padding: '6px 14px',
    fontSize: '13px', color: '#94a3b8',
    cursor: 'pointer', margin: '4px', display: 'inline-block',
  },
  input: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '8px', color: '#e2e8f0',
    padding: '12px 16px', fontSize: '14px',
    outline: 'none', flex: 1,
  },
  toolPill: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '99px', padding: '3px 10px',
    fontSize: '11px', color: '#64748b',
    display: 'inline-block', margin: '3px',
  },
  toolLog: {
    fontFamily: 'monospace', fontSize: '12px',
    display: 'flex', alignItems: 'center',
    gap: '8px', marginBottom: '6px',
  },
}

// ── Component ────────────────────────────────────────────────────

export default function Dashboard({ pendingQuery, onQueryConsumed }) {
  const [query,        setQuery]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [brief,        setBrief]        = useState(null)
  const [parsed,       setParsed]       = useState(null)
  const [currentQuery, setCurrentQuery] = useState('')
  const [toolCalls,    setToolCalls]    = useState([])
  const [downloading,  setDownloading]  = useState(false)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    if (pendingQuery) {
      onQueryConsumed && onQueryConsumed()
      handleSearch(pendingQuery)
    }
  }, [pendingQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (q) => {
    const searchQuery = typeof q === 'string' ? q : query
    if (!searchQuery.trim()) return
    setLoading(true)
    setBrief(null)
    setParsed(null)
    setError(null)
    setCurrentQuery(searchQuery)

    const initial = TOOLS.map(name => ({ name, status: 'pending' }))
    setToolCalls(initial)

    let toolIndex = 0
    const interval = setInterval(() => {
      if (toolIndex < TOOLS.length) {
        setToolCalls(prev => prev.map((t, i) => ({
          ...t,
          status: i < toolIndex ? 'done' : i === toolIndex ? 'running' : 'pending',
        })))
        toolIndex++
      }
    }, 2000)

    try {
      const res = await axios.post('http://localhost:8000/analyze', { query: searchQuery })
      clearInterval(interval)
      setToolCalls(TOOLS.map(name => ({ name, status: 'done' })))
      const briefText = res.data.result || res.data.brief || ''
      setBrief(briefText)
      setParsed(parseBrief(briefText))
      saveReport(searchQuery, briefText)
    } catch {
      clearInterval(interval)
      setError('Analysis failed. Check your API key and backend.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const res = await axios.post(
        'http://localhost:8000/export/docx',
        { query: currentQuery },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `analyst_report_${Date.now()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <div style={{ maxWidth: '500px', margin: '60px auto' }}>
        <div style={S.card}>
          <p style={{ color: '#e2e8f0', fontSize: '15px', marginBottom: '16px', fontWeight: '500' }}>
            Agent is running...
          </p>
          {toolCalls.map((t, i) => (
            <div key={i} style={S.toolLog}>
              <span style={{
                minWidth: '16px',
                color: t.status === 'done' ? '#1D9E75' : t.status === 'running' ? '#EF9F27' : '#4a5568',
              }}>
                {t.status === 'done' ? '✓' : t.status === 'running' ? '⟳' : '○'}
              </span>
              <span style={{
                color: t.status === 'done' ? '#94a3b8' : t.status === 'running' ? '#e2e8f0' : '#4a5568',
                fontFamily: 'monospace', fontSize: '13px',
              }}>
                {t.name}
              </span>
              <span style={{
                fontSize: '12px', marginLeft: 'auto',
                color: t.status === 'done' ? '#1D9E75' : t.status === 'running' ? '#EF9F27' : '#4a5568',
              }}>
                {t.status === 'done' ? '— done' : t.status === 'running' ? '— running...' : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Results ──────────────────────────────────────────────────────
  if (brief && parsed) return (
    <div style={S.page}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button style={S.outlineBtn} onClick={() => { setBrief(null); setParsed(null); setQuery('') }}>
          ← New Search
        </button>
        <span style={{ color: '#64748b', fontSize: '13px' }}>{currentQuery}</span>
        <div style={{ marginLeft: 'auto' }}>
          <button style={S.outlineBtn} onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating...' : '↓ Download Report'}
          </button>
        </div>
      </div>

      {/* Ticker header — all values inline (FIX 1) */}
      <div style={{
        background: '#161b27', border: '1px solid #2d3748',
        borderRadius: '12px', padding: '20px 24px',
        marginBottom: '20px', display: 'flex',
        alignItems: 'center', gap: '24px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '32px', fontWeight: '600', color: '#e2e8f0' }}>
          {parsed.ticker || currentQuery}
        </span>
        <span style={{ fontSize: '26px', fontWeight: '500', color: '#e2e8f0' }}>
          {parsed.price}
        </span>
        <span style={badgeStyle(parsed.signal)}>{parsed.signal}</span>
        <div style={{ display: 'flex', gap: '32px', marginLeft: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'P/E Ratio',      value: parsed.pe     },
            { label: 'Analyst Target', value: parsed.target },
            { label: 'Upside',         value: parsed.upside },
          ].map((m, i) => (
            <div key={i}>
              <div style={{
                fontSize: '11px', textTransform: 'uppercase',
                letterSpacing: '0.05em', color: '#64748b', marginBottom: '2px',
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '500', color: '#e2e8f0' }}>
                {m.value || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {parsed.summary && (
        <div style={S.card}>
          <SectionHeader title="Summary" />
          <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.8', margin: 0 }}>
            {parsed.summary.replace(/---+/g, '').trim()}
          </p>
        </div>
      )}

      {/* Key Metrics */}
      {parsed.keyMetrics.length > 0 && (
        <div style={S.card}>
          <SectionHeader title="Key Metrics" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {parsed.keyMetrics.map((r, i) => (
                <tr key={i} style={{
                  borderBottom: i < parsed.keyMetrics.length - 1 ? '1px solid #1e2535' : 'none',
                  background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  <td style={{ color: '#94a3b8', fontSize: '14px', padding: '12px 8px' }}>{stripMd(r.label)}</td>
                  <td style={{ color: '#e2e8f0', fontSize: '15px', padding: '12px 8px', textAlign: 'right', fontWeight: '600' }}>{stripMd(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend Analysis */}
      {parsed.trend && (
        <div style={S.card}>
          <SectionHeader title="Trend Analysis" />
          <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.8', margin: 0 }}>{parsed.trend}</p>
        </div>
      )}

      {/* Competitive Benchmarking */}
      {parsed.competitors.length > 0 && (
        <div style={S.card}>
          <SectionHeader title="Competitive Benchmarking" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {parsed.competitorHeaders.map((h, i) => (
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
                {parsed.competitors.map((row, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid #1e2535',
                    background: i === 0 ? 'rgba(29,158,117,0.08)' : 'transparent',
                  }}>
                    {parsed.competitorHeaders.map((h, j) => (
                      <td key={j} style={{
                        color: j === 0 ? (i === 0 ? '#1D9E75' : '#e2e8f0') : '#94a3b8',
                        fontSize: j === 0 ? '15px' : '14px',
                        fontWeight: j === 0 ? '600' : '400',
                        fontFamily: j > 0 ? 'monospace' : 'inherit',
                        padding: '12px 0',
                        textAlign: j === 0 ? 'left' : 'right',
                      }}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* News + Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={S.card}>
          <SectionHeader title="News & Sentiment" />
          {parsed.newsItems.length > 0
            ? parsed.newsItems.map((n, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < parsed.newsItems.length - 1 ? '1px solid #1e2535' : 'none' }}>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px',
                  marginBottom: '6px', display: 'inline-block',
                  background: n.sentiment === 'positive' ? '#0f3d2a'
                            : n.sentiment === 'negative' ? '#3d0f0f' : '#1e293b',
                  color: n.sentiment === 'positive' ? '#1D9E75'
                       : n.sentiment === 'negative' ? '#E24B4A' : '#94a3b8',
                }}>
                  {n.sentiment}
                </span>
                <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6', marginTop: '4px' }}>
                  {n.headline}
                </div>
              </div>
            ))
            : <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No headlines extracted</p>
          }
        </div>

        <div style={S.card}>
          <SectionHeader title="Risk Assessment" />
          {parsed.risk
            ? renderRecommendation(stripRiskEmoji(parsed.risk))
            : <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No risk data extracted</p>
          }
        </div>
      </div>

      {/* Recommendation */}
      {parsed.recommendation && (
        <div style={{
          background: '#0f1f14', borderLeft: '3px solid #1D9E75',
          border: '1px solid #2d3748', borderRadius: '12px',
          padding: '20px 24px', marginBottom: '16px',
        }}>
          <SectionHeader title="Recommendation" />
          {renderRecommendation(parsed.recommendation)}
        </div>
      )}

      {/* Tools called */}
      <div style={S.card}>
        <SectionHeader title="Tools Called" />
        <div>
          {parsed.toolsCalled.map((t, i) => (
            <span key={i} style={S.toolPill}>{t}</span>
          ))}
        </div>
      </div>

    </div>
  )

  // ── Search ───────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', gap: '16px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <p style={{
            fontSize: '11px', textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#1D9E75', marginBottom: '8px',
          }}>
            AI-POWERED FINANCIAL ANALYSIS
          </p>
          <h1 style={{ fontSize: '36px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
            Stock Analysis, Instantly
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>
            Enter a stock ticker or company name to get a full investment analysis
          </p>
        </div>

        {error && (
          <div style={{
            background: '#3d0f0f', border: '1px solid #E24B4A',
            borderRadius: '8px', padding: '12px 16px',
            color: '#E24B4A', fontSize: '14px',
            maxWidth: '500px', width: '100%',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '580px' }}>
          <input
            style={S.input}
            placeholder="Enter a ticker or company name... e.g. NVDA, Apple, Tesla"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <button style={S.primaryBtn} onClick={() => handleSearch()}>Analyze Stock</button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Try: NVDA · AAPL · TSLA · or any company name
        </p>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Popular stocks</p>
          <div>
            {['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META'].map(t => (
              <span key={t} style={S.chip} onClick={() => handleSearch('Analyze ' + t)}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
