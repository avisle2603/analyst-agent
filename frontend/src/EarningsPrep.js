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

function renderBulletLines(text) {
  if (!text) return null
  const clean = stripMd(text)
  const lines = clean.split(/\n+/).filter(l => l.trim().length > 5)
  if (lines.length <= 1) {
    return <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.8', margin: 0 }}>{clean}</p>
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

const CHIPS = ['AAPL', 'NVDA', 'MSFT', 'TSLA']

const S = {
  page: {
    padding: '28px', minHeight: '100vh',
    background: '#0f1117', color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px 24px', marginBottom: '16px',
  },
  input: {
    background: '#0f1117', border: '1px solid #2d3748',
    borderRadius: '8px', color: '#e2e8f0',
    padding: '12px 16px', fontSize: '14px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  btn: {
    background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: '8px',
    padding: '12px 24px', fontSize: '13px',
    fontWeight: '500', cursor: 'pointer', marginTop: '12px',
  },
  chip: {
    background: '#161b27', border: '1px solid #2d3748',
    borderRadius: '99px', padding: '6px 14px',
    fontSize: '13px', color: '#94a3b8',
    cursor: 'pointer', margin: '4px', display: 'inline-block',
  },
}

export default function EarningsPrep() {
  const [ticker,      setTicker]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [currentTk,  setCurrentTk]   = useState('')

  const run = async (t) => {
    const tk = (t || ticker).trim().toUpperCase()
    if (!tk) return
    setLoading(true)
    setResult(null)
    setCurrentTk(tk)
    try {
      const res = await axios.post('http://localhost:8000/analyze', {
        query: `Earnings prep for ${tk}: analyze last 4 quarters of EPS beat/miss history, identify the toughest questions analysts will ask, and generate 8 hard questions with predicted management responses`,
      })
      setResult(res.data.result || res.data.brief || '')
    } catch {
      setResult('Failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const download = async () => {
    try {
      setDownloading(true)
      const res = await axios.post(
        'http://localhost:8000/export/docx',
        { query: `Earnings prep for ${currentTk}` },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `earnings_prep_${currentTk}_${Date.now()}.docx`
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
          Earnings Call Prep
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.6' }}>
          Generate the tough questions before the call.
        </div>

        <input
          style={S.input}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && run()}
          maxLength={6}
          autoFocus
        />

        <div style={{ marginTop: '10px' }}>
          {CHIPS.map(c => (
            <span key={c} style={S.chip} onClick={() => { setTicker(c); run(c) }}>{c}</span>
          ))}
        </div>

        <button style={S.btn} onClick={() => run()} disabled={loading}>
          {loading ? 'Preparing...' : 'Prep for Earnings'}
        </button>
      </div>

      {loading && (
        <div style={S.card}>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Analyzing earnings history and generating questions...
          </p>
        </div>
      )}

      {result && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SectionHeader title={`Earnings Brief — ${currentTk}`} />
            <button
              style={{
                background: 'transparent', color: '#1D9E75',
                border: '1px solid #1D9E75', borderRadius: '8px',
                padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
                flexShrink: 0, marginLeft: '16px',
              }}
              onClick={download}
              disabled={downloading}
            >
              {downloading ? 'Generating...' : '↓ Download'}
            </button>
          </div>
          {renderBulletLines(result)}
        </div>
      )}
    </div>
  )
}
