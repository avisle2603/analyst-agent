import React, { useState, useRef } from 'react'
import axios from 'axios'

const TOOL_STEPS = [
  'Fetching last 4 quarters of earnings history...',
  'Analyzing guidance credibility track record...',
  'Cross-referencing numbers vs narrative...',
  'Generating the hard questions...',
]

const CHIPS = ['AAPL', 'NVDA', 'MSFT', 'TSLA']

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

// Strips markdown AND good/bad answer labels — used only on question text
function stripMdForQuestion(t) {
  if (!t) return ''
  return stripMd(t)
    .replace(/Good answer:/gi, '')
    .replace(/Bad answer:/gi, '')
    .replace(/Good:/gi, '')
    .replace(/Bad:/gi, '')
    .replace(/✅/g, '')
    .replace(/🚩/g, '')
    .replace(/🔴/g, '')
    .replace(/🟡/g, '')
    .replace(/🟢/g, '')
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

function parseSections(text) {
  const sections = {}
  const parts = ('\n' + text).split(/\n## /i)
  for (const part of parts) {
    if (!part.trim()) continue
    const nl = part.indexOf('\n')
    const rawKey = (nl === -1 ? part : part.slice(0, nl))
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/\*+/g, '')
      .toLowerCase()
      .trim()
    const content = nl === -1 ? '' : part.slice(nl + 1).trim()
    if (rawKey) sections[rawKey] = content
  }
  return sections
}

function getSec(sections, ...keywords) {
  for (const kw of keywords) {
    const key = Object.keys(sections).find(k => k.includes(kw.toLowerCase()))
    if (key !== undefined && sections[key]) return sections[key]
  }
  return ''
}

function parseFlags(content) {
  if (!content || !content.trim()) return []
  const parts = content.split(/^### /m).filter(p => p.trim())
  if (!parts.length) return []
  return parts.map(part => {
    const lines = part.split('\n')
    const titleLine = lines[0].trim()
    const bodyText = lines.slice(1).join('\n').trim()
    const combined = titleLine + ' ' + bodyText
    const sev = /\bHIGH\b/i.test(combined) ? 'HIGH'
              : /\bLOW\b/i.test(combined)  ? 'LOW' : 'MEDIUM'
    const title = titleLine
      .replace(/^FLAG\s*\d+[:\-\s]*/i, '')
      .replace(/\s*\((?:HIGH|MEDIUM|LOW)[^)]*\)/gi, '')
      .replace(/\s*[-–—]\s*(?:HIGH|MEDIUM|LOW)(?:\s+(?:SEVERITY|RISK))?/gi, '')
      .trim()
    return { severity: sev, title: stripMd(title) || titleLine, body: stripMd(bodyText) }
  }).filter(f => f.title)
}

function parseQuestions(content) {
  if (!content || !content.trim()) return []

  // Split into question blocks — handle ### , **Q#, Q#:, or numbered lines
  let parts
  if (/^### /m.test(content)) {
    parts = content.split(/^### /m).filter(p => p.trim())
  } else {
    parts = content.split(/(?=^(?:\*{0,2}Q\s*\d+|\d+\.))/m).filter(p => p.trim())
  }
  if (!parts.length) parts = [content]

  // Regex to locate the start of Good / Bad sections in the body
  const GOOD_RE = /(?:[-*•]\s*)?(?:✅\s*)?(?:\*{0,2})Good(?:\s+answer)?(?:\*{0,2})[:\s]/i
  const BAD_RE  = /(?:[-*•]\s*)?(?:❌\s*|🚩\s*)?(?:\*{0,2})Bad(?:\s+answer)?(?:\*{0,2})[:\s]/i

  return parts.map(part => {
    const lines = part.split('\n')
    const titleLine = lines[0].trim()
    const title = stripMd(titleLine)
      .replace(/^Q\s*\d+[.:)\s-]+/i, '')
      .replace(/^\d+\.\s+/, '')
      .trim()

    // Body text = everything after the title line
    const body = lines.slice(1).join('\n')

    // Locate good/bad sections by index so we can slice without overlap
    const goodIdx = body.search(GOOD_RE)
    const badIdx  = body.search(BAD_RE)

    let questionBlock, goodBlock, badBlock

    if (goodIdx !== -1 && badIdx !== -1 && badIdx > goodIdx) {
      questionBlock = body.slice(0, goodIdx)
      goodBlock     = body.slice(goodIdx, badIdx)
      badBlock      = body.slice(badIdx)
    } else if (goodIdx !== -1 && badIdx === -1) {
      questionBlock = body.slice(0, goodIdx)
      goodBlock     = body.slice(goodIdx)
      badBlock      = ''
    } else if (badIdx !== -1 && goodIdx === -1) {
      questionBlock = body.slice(0, badIdx)
      goodBlock     = ''
      badBlock      = body.slice(badIdx)
    } else {
      questionBlock = body
      goodBlock     = ''
      badBlock      = ''
    }

    // Extract question text from questionBlock only
    let question = ''
    const bqMatch = questionBlock.match(/^>\s*"?(.+?)"?\s*$/m)
    if (bqMatch) {
      question = bqMatch[1].trim()
    } else {
      // Quoted line or line ending with ?
      const qMatch = questionBlock.match(/^"([^"\n]+)"$/m)
        || questionBlock.match(/^(?!.*(?:Good|Bad|✅|❌|🚩))[^>\n]*\?\s*$/m)
      if (qMatch) question = qMatch[1] ? qMatch[1].trim() : qMatch[0].trim()
    }
    question = stripMdForQuestion(question)

    // Strip the label prefix from good/bad blocks to get just the value
    const goodAnswer = goodBlock
      ? stripMd(goodBlock.replace(GOOD_RE, '').trim())
      : ''
    const badAnswer = badBlock
      ? stripMd(badBlock.replace(BAD_RE, '').trim())
      : ''

    return { title: title || stripMd(titleLine), question, goodAnswer, badAnswer }
  }).filter(q => q.title || q.question)
}

function parseNumbers(content) {
  if (!content || !content.trim()) return []
  const parts = content.split(/^### /m).filter(p => p.trim())
  if (!parts.length) return []
  return parts.slice(0, 3).map(part => {
    const lines = part.split('\n').filter(l => l.trim())
    if (!lines.length) return null
    return {
      metric: stripMd(lines[0].replace(/^\d+\.\s*/, '').trim()),
      body:   stripMd(lines.slice(1).join('\n').trim()),
    }
  }).filter(Boolean).filter(n => n.metric)
}

function parseDecoder(text) {
  if (!text) return null
  const sections = parseSections(text)
  const summaryRaw = getSec(sections, 'decoder summary', 'summary', 'overview')
  const flagsRaw   = getSec(sections, 'red flag', 'warning sign', 'flag')
  const questRaw   = getSec(sections, '6 hard question', 'hard question', 'question')
  const numsRaw    = getSec(sections, 'numbers to watch', '3 numbers', 'number')
  const riskRaw    = getSec(sections, 'earnings risk', 'risk rating', 'risk')
  const credRaw    = getSec(sections, 'credibility')
  const riskSrc    = riskRaw + ' ' + text.slice(0, 600)
  const riskM      = riskSrc.match(/\b(HIGH|MEDIUM|LOW)\b/i)
  const riskRating = riskM ? riskM[1].toUpperCase() : 'MEDIUM'
  const credM      = credRaw.match(/(\d+(?:\.\d+)?)\s*\/\s*10/)
    || credRaw.match(/(\d+(?:\.\d+)?)\s+out\s+of\s+10/i)
  const credScore  = credM ? parseFloat(credM[1]) : null
  const credLabel  = credScore == null ? ''
    : credScore >= 8 ? 'Highly Credible'
    : credScore >= 6 ? 'Moderately Credible'
    : credScore >= 4 ? 'Mixed Track Record' : 'Low Credibility'
  const beatM      = text.match(/(\d+)\s+beat[s]?\s*,\s*(\d+)\s+miss/i)
    || text.match(/beat[s]?\s+(\d+)[,\s]+miss(?:es)?\s+(\d+)/i)
  const beatMiss   = beatM ? `${beatM[1]} beats, ${beatM[2]} misses` : '—'
  const flags      = parseFlags(flagsRaw)
  const questions  = parseQuestions(questRaw)
  const numbers    = parseNumbers(numsRaw)
  return {
    riskRating, riskBody: stripMd(riskRaw),
    credScore, credLabel, beatMiss,
    flagCount: flags.length,
    summaryText: stripMd(summaryRaw),
    flags, questions, numbers,
  }
}

const RISK_STYLE = {
  HIGH:   { bg: '#3d0f0f', color: '#E24B4A', border: '#E24B4A' },
  MEDIUM: { bg: '#3d2a0f', color: '#EF9F27', border: '#EF9F27' },
  LOW:    { bg: '#0f3d2a', color: '#1D9E75', border: '#1D9E75' },
}

const PAGE = {
  padding: '28px', minHeight: '100vh',
  background: '#0f1117', color: '#e2e8f0',
  fontFamily: 'system-ui, sans-serif',
}
const CARD = {
  background: '#161b27', border: '1px solid #2d3748',
  borderRadius: '12px', padding: '20px 24px', marginBottom: '16px',
}
const TOOL_LOG = {
  fontFamily: 'monospace', fontSize: '13px',
  display: 'flex', alignItems: 'center',
  gap: '8px', marginBottom: '6px',
}

export default function EarningsDecoder({ onRunAnalysis }) {
  const [view,           setView]           = useState('input')
  const [ticker,         setTicker]         = useState('')
  const [transcript,     setTranscript]     = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [decoded,        setDecoded]        = useState(null)
  const [rawTicker,      setRawTicker]      = useState('')
  const [toolCalls,      setToolCalls]      = useState([])
  const [downloading,    setDownloading]    = useState(false)
  const [error,          setError]          = useState('')
  const [expandedQ,      setExpandedQ]      = useState(null)
  const intervalRef = useRef(null)

  const startTools = () => {
    setToolCalls(TOOL_STEPS.map(name => ({ name, status: 'pending' })))
    let idx = 0
    intervalRef.current = setInterval(() => {
      if (idx < TOOL_STEPS.length) {
        setToolCalls(prev => prev.map((t, i) => ({
          ...t,
          status: i < idx ? 'done' : i === idx ? 'running' : 'pending',
        })))
        idx++
      } else {
        clearInterval(intervalRef.current)
      }
    }, 1800)
  }

  const runDecoder = async (t) => {
    const sym = (t || ticker).trim().toUpperCase()
    if (!sym) return
    setError('')
    setRawTicker(sym)
    setView('loading')
    startTools()
    try {
      const res = await axios.post('http://localhost:8000/earnings-decoder', {
        ticker: sym, transcript: transcript || '',
      })
      clearInterval(intervalRef.current)
      setToolCalls(TOOL_STEPS.map(name => ({ name, status: 'done' })))
      const parsedData = parseDecoder(res.data.decoder || '')
      setDecoded(parsedData)
      setView('results')
    } catch (err) {
      clearInterval(intervalRef.current)
      setError(err.response?.data?.detail || err.message)
      setView('input')
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await axios.post(
        'http://localhost:8000/export/earnings-decoder',
        { ticker: rawTicker, transcript },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `earnings_decoder_${rawTicker}_${Date.now()}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Download failed: ' + err.message)
    }
    setDownloading(false)
  }

  // ── INPUT ────────────────────────────────────────────────────────
  if (view === 'input') return (
    <div style={PAGE}>
      <div style={CARD}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D9E75', marginBottom: '8px' }}>
          Skeptical Analysis
        </p>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px', color: '#e2e8f0' }}>Earnings Decoder</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '20px', lineHeight: '1.6' }}>
          Find the gap between what the numbers show and what management claims
        </p>

        {error && (
          <div style={{ background: '#3d0f0f', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 16px', color: '#E24B4A', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: '8px', color: '#e2e8f0', padding: '12px 16px', fontSize: '14px', outline: 'none', flex: 1 }}
            placeholder="Ticker symbol, e.g. AAPL"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && runDecoder()}
            maxLength={6}
            autoFocus
          />
          <button
            style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
            onClick={() => runDecoder()}
          >
            Decode Earnings
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          {CHIPS.map(sym => (
            <span
              key={sym}
              style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: '99px', padding: '6px 14px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer', margin: '4px', display: 'inline-block' }}
              onClick={() => { setTicker(sym); runDecoder(sym) }}
            >
              {sym}
            </span>
          ))}
        </div>

        <div>
          <button
            style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
            onClick={() => setShowTranscript(v => !v)}
          >
            {showTranscript ? '▲ Hide transcript' : '▼ Add transcript for deeper analysis'}
          </button>
          {showTranscript && (
            <textarea
              style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: '8px', color: '#e2e8f0', padding: '12px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', marginTop: '10px' }}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste earnings call transcript here (optional)..."
              rows={6}
            />
          )}
        </div>
      </div>
    </div>
  )

  // ── LOADING ──────────────────────────────────────────────────────
  if (view === 'loading') return (
    <div style={PAGE}>
      <div style={{ maxWidth: '480px', margin: '60px auto' }}>
        <div style={CARD}>
          <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '4px' }}>{rawTicker}</div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>Running Earnings Decoder...</div>
          {toolCalls.map((t, i) => (
            <div key={i} style={TOOL_LOG}>
              <span style={{ minWidth: '16px', color: t.status === 'done' ? '#1D9E75' : t.status === 'running' ? '#EF9F27' : '#4a5568' }}>
                {t.status === 'done' ? '✓' : t.status === 'running' ? '⟳' : '○'}
              </span>
              <span style={{ color: t.status === 'done' ? '#94a3b8' : t.status === 'running' ? '#e2e8f0' : '#4a5568', fontFamily: 'monospace', fontSize: '13px' }}>
                {t.name}
              </span>
            </div>
          ))}
          <p style={{ fontSize: '13px', color: '#4a5568', marginTop: '12px' }}>
            Calling 4 analytical tools. This takes 20–40 seconds.
          </p>
        </div>
      </div>
    </div>
  )

  // ── RESULTS ──────────────────────────────────────────────────────
  if (view === 'results' && decoded) {
    const { riskRating, riskBody, credScore, credLabel, beatMiss, flagCount, summaryText, flags, questions, numbers } = decoded
    const rc = RISK_STYLE[riskRating] || RISK_STYLE.MEDIUM

    return (
      <div style={PAGE}>

        {/* Back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #2d3748', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}
            onClick={() => { setView('input'); setDecoded(null) }}
          >
            ← New Decoder
          </button>
          <span style={{ color: '#64748b', fontSize: '13px' }}>{rawTicker} — Earnings Decoder</span>
        </div>

        {/* 4 metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={CARD}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '10px' }}>Earnings Risk</div>
            <span style={{ background: rc.bg, color: rc.color, padding: '6px 14px', borderRadius: '99px', fontSize: '14px', fontWeight: '600' }}>
              {riskRating}
            </span>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '8px' }}>Credibility Score</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: credScore >= 7 ? '#1D9E75' : credScore >= 4 ? '#EF9F27' : '#E24B4A' }}>
              {credScore != null ? `${credScore}/10` : 'N/A'}
            </div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '8px' }}>Beat / Miss Record</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0' }}>{beatMiss}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Last 4 quarters</div>
          </div>
          <div style={CARD}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '8px' }}>Red Flags Found</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: flagCount >= 3 ? '#E24B4A' : flagCount >= 1 ? '#EF9F27' : '#1D9E75' }}>
              {flagCount}
            </div>
          </div>
        </div>

        {/* Summary */}
        {summaryText && (
          <div style={{ ...CARD, borderLeft: `3px solid ${rc.border}` }}>
            <SectionHeader title="Decoder Summary" />
            <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.8', margin: 0 }}>{summaryText}</p>
          </div>
        )}

        {/* Red Flags + Credibility */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #2d3748' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0' }}>Red Flags</span>
              {flagCount > 0 && (
                <span style={{ background: '#3d0f0f', color: '#E24B4A', borderRadius: '99px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>
                  {flagCount}
                </span>
              )}
            </div>
            {flags.length > 0 ? flags.map((f, i) => {
              const fc = RISK_STYLE[f.severity] || RISK_STYLE.MEDIUM
              const flagBg = f.severity === 'HIGH'   ? 'rgba(226,75,74,0.08)'
                           : f.severity === 'MEDIUM' ? 'rgba(239,159,39,0.08)'
                                                     : 'rgba(29,158,117,0.08)'
              return (
                <div key={i} style={{
                  border: `1px solid ${fc.border}44`, borderRadius: '10px',
                  padding: '14px 16px', marginBottom: '10px',
                  background: flagBg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: f.body ? '8px' : 0 }}>
                    <span style={{ background: fc.bg, color: fc.color, fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>{f.title}</span>
                  </div>
                  {f.body && <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{f.body}</p>}
                </div>
              )
            }) : (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No major red flags detected.</p>
            )}
          </div>

          <div style={CARD}>
            <SectionHeader title="Credibility Score" />
            <div style={{ fontSize: '48px', fontWeight: '700', color: credScore >= 7 ? '#1D9E75' : credScore >= 4 ? '#EF9F27' : '#E24B4A', margin: '8px 0 6px' }}>
              {credScore != null ? `${credScore}/10` : 'N/A'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '15px' }}>{credLabel}</div>
          </div>
        </div>

        {/* 6 Hard Questions */}
        {questions.length > 0 && (
          <div style={CARD}>
            <SectionHeader title="The Hard Questions" />
            {questions.map((q, i) => (
              <div
                key={i}
                style={{ background: '#161b27', border: '1px solid #2d3748', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}
              >
                {/* Header — always visible, click to expand */}
                <div
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'flex-start' }}
                  onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(29,158,117,0.15)', color: '#1D9E75',
                    fontSize: '13px', fontWeight: '600', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.6', fontWeight: '500', flex: 1 }}>
                    {stripMd(q.question || q.title)}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '18px', flexShrink: 0 }}>
                    {expandedQ === i ? '↑' : '↓'}
                  </span>
                </div>

                {/* Expanded content — good and bad each rendered exactly once */}
                {expandedQ === i && (
                  <div style={{ borderTop: '1px solid #2d3748', padding: '16px 20px 20px' }}>
                    {q.goodAnswer && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1D9E75', fontWeight: '600', marginBottom: '6px' }}>
                          Good answer
                        </div>
                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0, paddingLeft: '12px', borderLeft: '2px solid #1D9E75' }}>
                          {stripMd(q.goodAnswer)}
                        </p>
                      </div>
                    )}
                    {q.badAnswer && (
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#E24B4A', fontWeight: '600', marginBottom: '6px' }}>
                          Bad answer
                        </div>
                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0, paddingLeft: '12px', borderLeft: '2px solid #E24B4A' }}>
                          {stripMd(q.badAnswer)}
                        </p>
                      </div>
                    )}
                    {!q.goodAnswer && !q.badAnswer && (
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        No predicted answers available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3 Numbers to Watch */}
        {numbers.length > 0 && (
          <div style={CARD}>
            <SectionHeader title="3 Numbers to Watch Next Quarter" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
              {numbers.map((n, i) => (
                <div key={i} style={{ background: '#0f1117', borderLeft: '3px solid #EF9F27', border: '1px solid #2d3748', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#EF9F27', marginBottom: '8px' }}>{n.metric}</div>
                  {n.body && <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{n.body}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {riskBody && (
          <div style={{ ...CARD, borderLeft: `3px solid ${rc.border}` }}>
            <SectionHeader title="Risk Assessment" />
            <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.8', margin: 0 }}>{riskBody}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Generating...' : '↓ Download Decoder Report'}
          </button>
          {onRunAnalysis && (
            <button
              style={{ background: 'transparent', color: '#1D9E75', border: '1px solid #1D9E75', borderRadius: '8px', padding: '12px 20px', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => onRunAnalysis(rawTicker)}
            >
              ▦ Run Full Stock Analysis
            </button>
          )}
        </div>

      </div>
    )
  }

  return null
}
