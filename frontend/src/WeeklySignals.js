import React, { useState } from 'react'
import axios from 'axios'

const SIG_COLOR = { BUY: '#1D9E75', HOLD: '#EF9F27', SELL: '#E24B4A' }
const SIG_BG    = { BUY: '#0f3d2a', HOLD: '#3d2a0f', SELL: '#3d0f0f' }

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

function fmt(v, decimals = 1) {
  if (v == null) return '—'
  return parseFloat(v).toFixed(decimals)
}

function fmtPct(v) {
  if (v == null) return '—'
  const n = parseFloat(v)
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function fmtPrice(v) {
  if (v == null) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function scoreBreakdown(stock) {
  const rows = []
  const { revenue_growth, upside_to_target, gross_margin, pe_ratio, price_change_3m, price, week_52_high } = stock
  if (revenue_growth != null) {
    if (revenue_growth > 20)      rows.push({ pts: +25, text: 'Revenue growth above 20%' })
    else if (revenue_growth > 10) rows.push({ pts: +15, text: 'Revenue growth above 10%' })
    else if (revenue_growth < 0)  rows.push({ pts: -20, text: 'Revenue declining' })
  }
  if (upside_to_target != null) {
    if (upside_to_target > 20)      rows.push({ pts: +25, text: 'Analyst upside above 20%' })
    else if (upside_to_target > 10) rows.push({ pts: +15, text: 'Analyst upside above 10%' })
    else if (upside_to_target < 0)  rows.push({ pts: -25, text: 'Trading above analyst target' })
  }
  if (gross_margin != null) {
    if (gross_margin > 60)      rows.push({ pts: +15, text: 'Gross margin above 60%' })
    else if (gross_margin > 40) rows.push({ pts: +10, text: 'Gross margin above 40%' })
    else if (gross_margin < 20) rows.push({ pts: -10, text: 'Gross margin below 20%' })
  }
  if (pe_ratio != null) {
    if (pe_ratio < 15)      rows.push({ pts: +15, text: 'Attractive valuation (P/E below 15x)' })
    else if (pe_ratio < 25) rows.push({ pts:  +5, text: 'Reasonable valuation (P/E below 25x)' })
    else if (pe_ratio > 50) rows.push({ pts: -10, text: 'Expensive valuation (P/E above 50x)' })
  }
  if (price_change_3m != null) {
    if (price_change_3m > 15)       rows.push({ pts: +10, text: 'Strong momentum (+15% in 3 months)' })
    else if (price_change_3m < -15) rows.push({ pts: -15, text: 'Weak momentum (-15% in 3 months)' })
  }
  if (price && week_52_high) {
    const pct = (price - week_52_high) / week_52_high * 100
    if (pct > -10)      rows.push({ pts: +5, text: 'Near 52-week high' })
    else if (pct < -30) rows.push({ pts: -5, text: 'Far below 52-week high' })
  }
  return rows
}

function StockCard({ stock, onRunAnalysis }) {
  const [expanded,   setExpanded]   = useState(false)
  const [watchAdded, setWatchAdded] = useState(false)

  const sig   = stock.signal
  const color = SIG_COLOR[sig] || '#94a3b8'
  const bg    = SIG_BG[sig]   || '#1a1f2e'
  const breakdown = scoreBreakdown(stock)

  const addToWatchlist = (e) => {
    e.stopPropagation()
    try {
      const raw = localStorage.getItem('analyst_watchlist')
      const wl  = raw ? JSON.parse(raw) : ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN']
      if (!wl.includes(stock.ticker)) {
        localStorage.setItem('analyst_watchlist', JSON.stringify([...wl, stock.ticker]))
      }
    } catch {}
    setWatchAdded(true)
    setTimeout(() => setWatchAdded(false), 2000)
  }

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: '#161b27',
        border: `1px solid ${expanded ? color : '#2d3748'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '12px',
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Signal badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <span style={{ background: bg, color, fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '4px' }}>
          {sig}
        </span>
        {stock.conviction && (
          <span style={{ border: `1px solid ${color}`, color, fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', opacity: 0.8 }}>
            {stock.conviction}
          </span>
        )}
      </div>

      {/* Ticker + price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#e2e8f0' }}>{stock.ticker}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{stripMd(stock.name || '')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#e2e8f0' }}>{fmtPrice(stock.price)}</div>
          {stock.price_change_3m != null && (
            <div style={{ fontSize: '13px', marginTop: '2px', color: stock.price_change_3m >= 0 ? '#1D9E75' : '#E24B4A' }}>
              {fmtPct(stock.price_change_3m)}
            </div>
          )}
        </div>
      </div>

      {/* Metric chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'UPSIDE',     value: stock.upside_to_target,  render: v => ({ text: fmtPct(v),        color: v >= 0 ? '#1D9E75' : '#E24B4A' }) },
          { label: 'REV GROWTH', value: stock.revenue_growth,    render: v => ({ text: fmtPct(v),        color: v >= 0 ? '#1D9E75' : '#E24B4A' }) },
          { label: 'P/E RATIO',  value: stock.pe_ratio,          render: v => ({ text: fmt(v, 1) + 'x', color: '#e2e8f0' }) },
        ].map(({ label, value, render }) => {
          const r = value != null ? render(value) : null
          return (
            <div key={label} style={{ flex: 1, background: '#0f1117', borderRadius: '6px', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '3px', color: r ? r.color : '#475569' }}>
                {r ? r.text : '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Top reasons */}
      <div style={{ marginBottom: '10px' }}>
        {stock.reasons_buy && stock.reasons_buy[0] && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '13px', color: '#4ade80', marginBottom: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1D9E75', flexShrink: 0, display: 'inline-block', marginTop: '5px' }} />
            <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{stripMd(stock.reasons_buy[0])}</span>
          </div>
        )}
        {stock.reasons_risk && stock.reasons_risk[0] && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '13px', color: '#f87171' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#E24B4A', flexShrink: 0, display: 'inline-block', marginTop: '5px' }} />
            <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{stripMd(stock.reasons_risk[0])}</span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{
        fontSize: '13px', color: '#94a3b8', lineHeight: '1.6',
        display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {stripMd(stock.summary || '')}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '16px', borderTop: '1px solid #2d3748', paddingTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: '16px' }}>
            {[
              ['Price',           fmtPrice(stock.price)],
              ['Analyst Target',  fmtPrice(stock.analyst_target)],
              ['Upside',          fmtPct(stock.upside_to_target)],
              ['52-Week High',    fmtPrice(stock.week_52_high)],
              ['52-Week Low',     fmtPrice(stock.week_52_low)],
              ['Revenue Growth',  fmtPct(stock.revenue_growth)],
              ['Gross Margin',    stock.gross_margin != null ? fmt(stock.gross_margin, 1) + '%' : '—'],
              ['P/E Ratio',       stock.pe_ratio != null ? fmt(stock.pe_ratio, 1) + 'x' : '—'],
              ['Dividend Yield',  stock.dividend_yield != null ? fmt(stock.dividend_yield, 2) + '%' : '—'],
              ['Beta',            stock.beta != null ? fmt(stock.beta, 2) : '—'],
              ['3M Change',       fmtPct(stock.price_change_3m)],
              ['Signal Score',    stock.score + ' / 100'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a2234', paddingBottom: '5px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{value || '—'}</span>
              </div>
            ))}
          </div>

          {breakdown.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Why this score
              </div>
              {breakdown.map((row, i) => (
                <div key={i} style={{ fontSize: '13px', color: row.pts >= 0 ? '#4ade80' : '#f87171', marginBottom: '4px' }}>
                  {row.pts >= 0 ? '+' : ''}{row.pts} pts — {row.text}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => onRunAnalysis && onRunAnalysis(stock.ticker)}
              style={{ flex: 1, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Run Full Analysis
            </button>
            <button
              onClick={addToWatchlist}
              style={{ flex: 1, background: 'transparent', color: watchAdded ? '#1D9E75' : '#94a3b8', border: `1px solid ${watchAdded ? '#1D9E75' : '#2d3748'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              {watchAdded ? 'Added!' : 'Add to Watchlist'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export default function WeeklySignals({ onRunAnalysis }) {
  const [state,  setState]  = useState('ready')
  const [data,   setData]   = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [sort,   setSort]   = useState('score')
  const [isDL,   setDL]     = useState(false)

  const PAGE = {
    padding: '28px', maxWidth: '1100px', margin: '0 auto',
    color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
  }

  async function runScreen() {
    setState('loading')
    try {
      const res = await axios.post('http://localhost:8000/weekly-signals', {}, { timeout: 120000 })
      setData(res.data)
      setFilter('ALL')
      setState('results')
    } catch (err) {
      setState('ready')
      alert('Screen failed: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleDownload() {
    if (!data) return
    setDL(true)
    const buys  = data.stocks.filter(s => s.signal === 'BUY')
    const holds = data.stocks.filter(s => s.signal === 'HOLD')
    const sells = data.stocks.filter(s => s.signal === 'SELL')
    const section = (stocks) => stocks.map(s =>
      `${s.ticker} — ${s.name}\n` +
      `Price: ${fmtPrice(s.price)} | Upside: ${fmtPct(s.upside_to_target)} | Revenue Growth: ${fmtPct(s.revenue_growth)}\n` +
      (s.reasons_buy && s.reasons_buy[0]  ? `Strength: ${s.reasons_buy[0]}\n`  : '') +
      (s.reasons_risk && s.reasons_risk[0] ? `Risk: ${s.reasons_risk[0]}\n` : '') +
      s.summary
    ).join('\n\n')
    const brief = [
      `## Weekly Stock Signals — ${data.generated_at}`,
      '', '## Buy Signals', section(buys),
      '', '## Hold Signals', section(holds),
      '', '## Sell Signals', section(sells),
      '', '## Disclaimer',
      'This report is generated from publicly available data via Yahoo Finance. Not financial advice.',
    ].join('\n')
    try {
      const res = await axios.post('http://localhost:8000/export/docx', { query: brief }, { responseType: 'blob', timeout: 60000 })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `weekly_signals_${Date.now()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Download failed: ' + err.message)
    }
    setDL(false)
  }

  // ── Ready ────────────────────────────────────────────────────────
  if (state === 'ready') return (
    <div style={PAGE}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '28px', fontWeight: '600', color: '#e2e8f0' }}>Weekly Signals</div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px' }}>Live stock screen across 20 securities</div>
      </div>

      <div style={{ display: 'flex', gap: '16px', margin: '32px 0' }}>
        {[
          ['20 stocks screened', '◈'],
          ['Live data via Yahoo Finance', '◉'],
          ['Updated on demand', '▦'],
        ].map(([text, icon]) => (
          <div key={text} style={{ flex: 1, background: '#161b27', border: '1px solid #2d3748', borderRadius: '12px', padding: '18px 20px', fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#1D9E75', fontSize: '18px' }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '48px' }}>
        <button
          onClick={runScreen}
          style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px 40px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
        >
          Run Screen
        </button>
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
          Takes 30-60 seconds to fetch live data for all stocks
        </div>
      </div>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={{ ...PAGE, textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #2d3748', borderTopColor: '#1D9E75', animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '20px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>Screening 20 stocks...</div>
      <div style={{ fontSize: '14px', color: '#64748b' }}>
        Fetching live prices, margins, analyst targets, and momentum data
      </div>
    </div>
  )

  // ── Results ──────────────────────────────────────────────────────
  let stocks = data ? [...data.stocks] : []
  if (filter !== 'ALL') stocks = stocks.filter(s => s.signal === filter)
  const sigOrder = { BUY: 0, HOLD: 1, SELL: 2 }
  if (sort === 'upside')       stocks.sort((a, b) => (b.upside_to_target ?? -999) - (a.upside_to_target ?? -999))
  else if (sort === 'revenue') stocks.sort((a, b) => (b.revenue_growth ?? -999) - (a.revenue_growth ?? -999))
  else if (sort === 'pe')      stocks.sort((a, b) => (a.pe_ratio ?? 999) - (b.pe_ratio ?? 999))
  else stocks.sort((a, b) => { const d = (sigOrder[a.signal] ?? 1) - (sigOrder[b.signal] ?? 1); return d !== 0 ? d : b.score - a.score })

  const counts = data ? { BUY: data.buy_count, HOLD: data.hold_count, SELL: data.sell_count } : { BUY: 0, HOLD: 0, SELL: 0 }

  return (
    <div style={PAGE}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: '600', color: '#e2e8f0' }}>Weekly Signals</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{data.generated_at}</div>
        </div>
        <button onClick={runScreen} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #2d3748', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}>
          Refresh Data
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Buy signals',   count: counts.BUY,  color: SIG_COLOR.BUY },
          { label: 'Hold',          count: counts.HOLD, color: SIG_COLOR.HOLD },
          { label: 'Sell or avoid', count: counts.SELL, color: SIG_COLOR.SELL },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ flex: 1, background: '#161b27', border: '1px solid #2d3748', borderRadius: '12px', padding: '18px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color }}>{count}</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'BUY', 'HOLD', 'SELL'].map(f => {
            const active = filter === f
            const fColor = f === 'ALL' ? '#1D9E75' : SIG_COLOR[f]
            const ct     = f === 'ALL' ? data.stocks.length : counts[f]
            return (
              <button key={f} onClick={() => setFilter(f)} style={{ background: active ? fColor : 'transparent', color: active ? '#fff' : '#94a3b8', border: `1px solid ${active ? fColor : '#2d3748'}`, borderRadius: '20px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                {f} ({ct})
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Sort:</span>
          {[{ key: 'score', label: 'Score' }, { key: 'upside', label: 'Upside' }, { key: 'revenue', label: 'Revenue' }, { key: 'pe', label: 'P/E' }].map(({ key, label }) => (
            <button key={key} onClick={() => setSort(key)} style={{ background: sort === key ? '#1a2234' : 'transparent', color: sort === key ? '#e2e8f0' : '#64748b', border: `1px solid ${sort === key ? '#2d3748' : 'transparent'}`, borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '16px', marginBottom: '32px' }}>
        {stocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock} onRunAnalysis={onRunAnalysis} />
        ))}
      </div>

      {/* Download */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <button
          onClick={handleDownload}
          disabled={isDL}
          style={{ background: isDL ? '#2d3748' : '#161b27', color: isDL ? '#64748b' : '#94a3b8', border: '1px solid #2d3748', borderRadius: '8px', padding: '12px 28px', fontSize: '13px', fontWeight: '600', cursor: isDL ? 'default' : 'pointer' }}
        >
          {isDL ? 'Generating...' : 'Download Signals Report'}
        </button>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: '12px', color: '#475569', textAlign: 'center', borderTop: '1px solid #1a2234', paddingTop: '20px', lineHeight: '1.6', maxWidth: '700px', margin: '0 auto' }}>
        Signal scores are calculated from live financial data via Yahoo Finance.
        This is not financial advice. Scores are based on quantitative factors only
        and do not constitute a recommendation to buy or sell any security.
        Always conduct your own research.
      </div>
    </div>
  )
}
