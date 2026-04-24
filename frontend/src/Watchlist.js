import React, { useState, useEffect } from 'react'

const S = {
  page: {
    padding: '28px', minHeight: '100vh',
    background: '#0f1117', color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  title:  { fontSize: '24px', fontWeight: '600', marginBottom: '6px', color: '#e2e8f0' },
  sub:    { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.6' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px', marginBottom: '24px',
  },
  tickerCard: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  ticker:     { fontSize: '22px', fontWeight: '600', color: '#e2e8f0' },
  analyzeBtn: {
    background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '10px 14px', fontSize: '14px',
    fontWeight: '500', cursor: 'pointer',
  },
  removeBtn: {
    background: 'transparent', color: '#E24B4A',
    border: '1px solid #E24B4A', borderRadius: '8px',
    padding: '10px 14px', fontSize: '14px', cursor: 'pointer',
  },
  addRow: { display: 'flex', gap: '8px', marginTop: '8px' },
  input: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '8px', color: '#e2e8f0',
    padding: '12px 16px', fontSize: '14px',
    outline: 'none', flex: 1,
  },
  addBtn: {
    background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '12px 24px', fontSize: '14px',
    fontWeight: '500', cursor: 'pointer',
  },
  empty: {
    color: '#64748b', fontSize: '15px',
    textAlign: 'center', padding: '40px 0',
  },
}

const DEFAULTS = ['NVDA', 'AAPL', 'MSFT', 'TSLA']

export default function Watchlist({ onAnalyze }) {
  const [tickers,   setTickers]   = useState([])
  const [newTicker, setNewTicker] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('analyst_watchlist')
    if (saved) {
      try { setTickers(JSON.parse(saved)) }
      catch { setTickers(DEFAULTS) }
    } else {
      setTickers(DEFAULTS)
    }
  }, [])

  const save = (list) => {
    setTickers(list)
    localStorage.setItem('analyst_watchlist', JSON.stringify(list))
  }

  const addTicker = () => {
    const t = newTicker.toUpperCase().trim()
    if (t && !tickers.includes(t)) save([...tickers, t])
    setNewTicker('')
  }

  const removeTicker = (t) => save(tickers.filter(x => x !== t))

  return (
    <div style={S.page}>
      <div style={S.title}>Watchlist</div>
      <div style={S.sub}>Click a ticker to run a full analysis.</div>

      {tickers.length === 0 ? (
        <div style={S.empty}>Your watchlist is empty. Add tickers below.</div>
      ) : (
        <div style={S.grid}>
          {tickers.map(t => (
            <div key={t} style={S.tickerCard}>
              <div style={S.ticker}>{t}</div>
              <button style={S.analyzeBtn} onClick={() => onAnalyze && onAnalyze(t)}>
                Analyze
              </button>
              <button style={S.removeBtn} onClick={() => removeTicker(t)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={S.addRow}>
        <input
          style={S.input}
          placeholder="Add ticker..."
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          maxLength={6}
        />
        <button style={S.addBtn} onClick={addTicker}>Add</button>
      </div>
    </div>
  )
}
