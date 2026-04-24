import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './EarningsDecoder.css';

const API_BASE = 'http://localhost:8000';
const QUICK_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'TSLA'];
const TOOL_STEPS = [
  'Fetching last 4 quarters of earnings history...',
  'Analyzing guidance credibility track record...',
  'Cross-referencing numbers vs narrative...',
  'Generating the hard questions...',
];

// ─────────────────────────────────────────────────────────────────────────────
// PARSING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip all markdown syntax — keep the readable text only.
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]*)\*\*/g, '$1')          // **bold** → bold
    .replace(/\*([^*]*)\*/g, '$1')               // *italic* → italic
    .replace(/^>\s*/gm, '')                      // > blockquote markers
    .replace(/^#{1,6}\s+/gm, '')                // ## headings
    .replace(/^[-*•]\s+/gm, '• ')               // bullets → •
    .replace(/`([^`]*)`/g, '$1')                // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // [link](url) → link
    .replace(/\n{3,}/g, '\n\n')                 // collapse 3+ blank lines
    .trim();
}

/**
 * Split raw agent output into top-level sections by ## headers.
 * ### subheadings stay inside each section's content string.
 * Returns { "lowercase key": "content string" }
 */
function splitSections(text) {
  const sections = {};
  // Prepend \n so a ## at position 0 is caught by the split
  const parts = ('\n' + text).split(/\n## /);
  for (const part of parts) {
    if (!part.trim()) continue;
    const nl = part.indexOf('\n');
    const rawKey = nl === -1 ? part : part.slice(0, nl);
    const content = nl === -1 ? '' : part.slice(nl + 1).trim();
    // Normalize key: strip non-ASCII (emoji), bold markers, lowercase
    const key = rawKey
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/\*+/g, '')
      .toLowerCase()
      .trim();
    if (key) sections[key] = content;
  }
  return sections;
}

/**
 * Find a section by trying keyword fragments (case-insensitive substring).
 * Returns the first match's content string, or ''.
 */
function getSec(sections, ...keywords) {
  for (const kw of keywords) {
    const key = Object.keys(sections).find(k => k.includes(kw.toLowerCase()));
    if (key !== undefined && sections[key]) return sections[key];
  }
  return '';
}

/**
 * Return HIGH/MEDIUM/LOW if explicitly found in text, otherwise null.
 */
function detectSeverityExplicit(text) {
  if (!text) return null;
  if (/\bHIGH\b/i.test(text))   return 'HIGH';
  if (/\bMEDIUM\b/i.test(text)) return 'MEDIUM';
  if (/\bLOW\b/i.test(text))    return 'LOW';
  return null;
}

/**
 * Parse a markdown pipe table into { headers, rows }.
 * Skips separator rows (|---|---| style).
 * Returns null if no valid table rows found.
 */
function parseMarkdownTable(text) {
  if (!text || !text.includes('|')) return null;

  const parseRow = line =>
    line.split('|').map(c => c.trim()).filter(c => c !== '');

  const lines = text.split('\n');
  const tableRows = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    // Skip separator rows: |---|---| or | :---: | etc.
    if (/^\|[\s\-|:]+\|?\s*$/.test(t)) continue;
    const cells = parseRow(t);
    if (cells.length > 0) tableRows.push(cells);
  }

  if (tableRows.length === 0) return null;
  return { headers: tableRows[0], rows: tableRows.slice(1) };
}

/**
 * Safety-net: convert any lingering markdown table lines in text to
 * readable "cell1 — cell2" prose. Applied before plain-text rendering.
 */
function stripMarkdownTable(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => {
      const t = line.trim();
      // Drop separator rows entirely
      if (/^\|[\s\-|:]+\|?\s*$/.test(t)) return '';
      // Convert data rows to "cell1 — cell2 — cell3"
      if (t.startsWith('|')) {
        const cells = t.split('|').map(c => stripMarkdown(c.trim())).filter(Boolean);
        return cells.join(' — ');
      }
      return line;
    })
    .filter(l => l !== '')
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION PARSERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the Red Flags section.
 * Splits on ### subheadings; each subheading becomes one flag card.
 * Returns: [{ severity, title, body }]
 */
function parseFlags(content) {
  if (!content || !content.trim()) return [];

  const rawParts = content.split(/^### /m).filter(p => p.trim());
  if (rawParts.length === 0) return [];

  return rawParts.map(part => {
    const lines = part.split('\n');
    const titleLine = lines[0].trim();
    const bodyText  = lines.slice(1).join('\n').trim();

    // Severity: explicit match in title first, then body
    const severity = detectSeverityExplicit(titleLine)
      || detectSeverityExplicit(bodyText)
      || 'MEDIUM';

    // Clean title: remove "FLAG N:" prefix and severity annotations like "(HIGH Severity)"
    const title = titleLine
      .replace(/^FLAG\s*\d+[:\-\s]*/i, '')
      .replace(/\s*\((?:HIGH|MEDIUM|LOW)[^)]*\)/gi, '')
      .replace(/\s*[-–—]\s*(?:HIGH|MEDIUM|LOW)(?:\s+(?:SEVERITY|RISK))?/gi, '')
      .trim();

    return {
      severity,
      title: stripMarkdown(title) || 'Unnamed Flag',
      body:  stripMarkdown(bodyText),
    };
  }).filter(f => f.title !== 'Unnamed Flag' || f.body);
}

/**
 * Parse the Questions section.
 * Splits on ### subheadings; extracts blockquote text, good/bad answers.
 * Returns: [{ title, questionText, goodAnswer, badAnswer }]
 */
function parseQuestions(content) {
  if (!content || !content.trim()) return [];

  const rawParts = content.split(/^### /m).filter(p => p.trim());
  if (rawParts.length === 0) return [];

  return rawParts.map(part => {
    const lines    = part.split('\n');
    const titleLine = lines[0].trim();
    const bodyText  = lines.slice(1).join('\n');

    // Clean title: remove "Q1:", "Q 1:", "1." prefixes
    const title = titleLine
      .replace(/^Q\s*\d+[:\-\s]*/i, '')
      .replace(/^\d+\.\s*/, '')
      .trim();

    // Blockquote line (> "actual question text") → italic question display
    const bqM = bodyText.match(/^>\s*\*{0,2}"?([^"*\n]+?)"?\*{0,2}\s*$/m);
    const questionText = bqM ? bqM[1].trim() : '';

    // Good answer: "✅ ..." or "- Good answer: ..."
    const goodM = bodyText.match(
      /(?:✅|[-*]\s*Good answer)[:\s]*(.+?)(?=\n[-*✅❌]|\n\n|$)/is
    );
    // Bad answer: "❌ ..." or "- Bad answer: ..."
    const badM = bodyText.match(
      /(?:❌|[-*]\s*Bad answer)[:\s]*(.+?)(?=\n[-*✅❌]|\n\n|$)/is
    );

    return {
      title:        stripMarkdown(title) || titleLine,
      questionText: stripMarkdown(questionText),
      goodAnswer:   goodM ? stripMarkdown(goodM[1].trim()) : '',
      badAnswer:    badM  ? stripMarkdown(badM[1].trim())  : '',
    };
  }).filter(q => q.title);
}

/**
 * Parse the 3 Numbers to Watch section.
 * Strategy 1: markdown table (| # | Metric | Why | Threshold |)
 * Strategy 2: ### subheadings
 * Strategy 3: numbered lines (1. Metric Name)
 * Returns: [{ metric, body }]
 */
function parseNumbers(content) {
  if (!content || !content.trim()) return [];

  // Strategy 1: markdown table
  if (content.includes('|')) {
    const table = parseMarkdownTable(content);
    if (table && table.rows.length > 0) {
      return table.rows.slice(0, 3).map(cells => {
        let metric, why, threshold;
        // Handle 4-cell rows where first cell is a row number (| # | Metric | Why | Threshold |)
        if (cells.length >= 4 && /^\d+$/.test(cells[0])) {
          metric    = stripMarkdown(cells[1] || '');
          why       = stripMarkdown(cells[2] || '');
          threshold = stripMarkdown(cells[3] || '');
        } else {
          metric    = stripMarkdown(cells[0] || '');
          why       = stripMarkdown(cells[1] || '');
          threshold = stripMarkdown(cells[2] || '');
        }
        const body = [why, threshold].filter(Boolean).join(' — ');
        return { metric, body };
      }).filter(n => n.metric);
    }
  }

  // Strategy 2: ### subheadings
  let rawParts = content.split(/^### /m).filter(p => p.trim());

  // Strategy 3: numbered lines like "1. Metric Name"
  if (rawParts.length === 0) {
    rawParts = content.split(/(?=^\d+\.)/m).filter(p => p.trim());
  }

  return rawParts.slice(0, 3).map(part => {
    const lines = part.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    const rawMetric = lines[0].trim().replace(/^\d+\.\s*/, '');
    const body = lines.slice(1).join('\n').trim();
    return {
      metric: stripMarkdown(rawMetric),
      body:   stripMarkdown(body),
    };
  }).filter(Boolean).filter(n => n.metric);
}

/**
 * Extract a numeric credibility score (1–10) from section text.
 */
function extractCredScore(text) {
  if (!text) return null;
  const m =
    text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/)             ||
    text.match(/(\d+(?:\.\d+)?)\s+out\s+of\s+10/i)      ||
    text.match(/[Ss]core[:\s]+\*{0,2}(\d+(?:\.\d+)?)\*{0,2}/) ||
    text.match(/[Rr]ating[:\s]+\*{0,2}(\d+(?:\.\d+)?)\*{0,2}/) ||
    text.match(/\b(10|[1-9])\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return (n >= 1 && n <= 10) ? n : null;
}

function credScoreLabel(score) {
  if (score === null || score === undefined) return '';
  if (score >= 8) return 'Highly Credible';
  if (score >= 6) return 'Moderately Credible';
  if (score >= 4) return 'Mixed Track Record';
  return 'Low Credibility';
}

function credColorClass(score) {
  if (score === null || score === undefined) return '';
  if (score >= 7) return 'ed-cred-green';
  if (score >= 4) return 'ed-cred-amber';
  return 'ed-cred-red';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseDecoder(text, ticker = '') {
  if (!text) return null;

  // Portfolio mode: ticker itself suggests a portfolio query
  const isPortfolio = /portfolio|holdings|allocation|%/i.test(ticker);

  const sections = splitSections(text);

  // Locate each section with fuzzy keyword matching
  const summaryRaw = getSec(sections,
    'decoder summary', 'summary', 'overview', 'executive');
  const flagsRaw   = getSec(sections,
    'red flag', 'warning sign', 'red ', 'flag', 'warning');
  const questRaw   = getSec(sections,
    '6 hard question', 'hard question', 'analyst question', 'key question', 'question');
  const numsRaw    = getSec(sections,
    'numbers to watch', '3 numbers', 'number', 'watch next');
  const riskRaw    = getSec(sections,
    'overall earnings risk', 'earnings risk rating', 'risk rating', 'risk');
  const credRaw    = getSec(sections,
    'credibility score', 'credib');

  // Risk rating — search risk section content, then first 600 chars of full text
  const riskSrc    = (riskRaw || '') + ' ' + text.slice(0, 600);
  const riskM      = riskSrc.match(/\b(HIGH|MEDIUM|LOW)\b/i);
  const riskRating = riskM ? riskM[1].toUpperCase() : 'MEDIUM';

  // Credibility
  const credScore   = extractCredScore(credRaw);
  const credLabel   = credScoreLabel(credScore);
  // Remove the "X/10" score line so it doesn't repeat in the body
  const credBodyRaw = credRaw
    ? credRaw.replace(/^[\d.]+\s*\/?\s*10?.*/m, '').trim()
    : '';
  // Split credibility body into table data (key-value signals) and prose text
  let credTableData = null;
  let credBody      = '';
  if (credBodyRaw) {
    if (credBodyRaw.includes('|')) {
      const table = parseMarkdownTable(credBodyRaw);
      if (table && table.rows.length > 0) {
        credTableData = table.rows
          .map(cells => ({
            label:  stripMarkdown(cells[0] || ''),
            detail: stripMarkdown(cells[1] || ''),
          }))
          .filter(r => r.label);
      }
    }
    // Prose = non-pipe lines (present alongside or instead of a table)
    const proseLines = credBodyRaw.split('\n').filter(l => !l.trim().startsWith('|'));
    credBody = stripMarkdown(proseLines.join('\n').trim());
  }

  // Beat/miss record — scan full text
  const beatM = text.match(/(\d+)\s+beat[s]?\s*,\s*(\d+)\s+miss/i)
    || text.match(/beat[s]?\s+(\d+)[,\s]+miss(?:es)?\s+(\d+)/i);
  const beatMissRecord = beatM ? `${beatM[1]} beats, ${beatM[2]} misses` : '—';

  // Parse structured data from each section
  const flags     = parseFlags(flagsRaw);
  const questions = parseQuestions(questRaw);
  const numbers   = parseNumbers(numsRaw);

  // If standard sections are empty, treat as portfolio/non-standard mode
  const effectivePortfolio = isPortfolio
    || (flags.length === 0 && questions.length === 0 && !flagsRaw && !questRaw);

  return {
    isPortfolio:    effectivePortfolio,
    riskRating,
    riskBody:       stripMarkdown(riskRaw),
    credScore,
    credLabel,
    credTableData,
    credBody,
    beatMissRecord,
    flagCount:      flags.length,
    summaryText:    stripMarkdown(summaryRaw),
    flags,
    questions,
    numbers,
    // Raw content kept for PlainText fallback
    flagsRaw,
    questRaw,
    numsRaw,
    rawText: text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render already-stripped text as clean readable paragraphs.
 * Lines starting with "• " get an amber bullet point.
 * Applies stripMarkdownTable as a safety net so raw pipe characters
 * never reach the DOM regardless of which section passes the text.
 */
function RenderText({ text }) {
  if (!text) return null;
  const safe = stripMarkdownTable(text);
  const els = [];
  for (const [i, raw] of safe.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('• ')) {
      els.push(
        <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: '0.85rem' }}>
          <span style={{ color: '#f59e0b', flexShrink: 0 }}>•</span>
          <span style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{line.slice(2)}</span>
        </div>
      );
    } else {
      els.push(
        <p key={i} style={{ margin: '3px 0', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--muted)' }}>
          {line}
        </p>
      );
    }
  }
  return els.length > 0 ? <div>{els}</div> : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  return <span className={`ed-severity ${severity.toLowerCase()}`}>{severity}</span>;
}

function RiskBadge({ rating }) {
  return <span className={`ed-risk-badge ${rating.toLowerCase()}`}>{rating}</span>;
}

function FlagCard({ flag }) {
  return (
    <div className={`ed-flag-card ${flag.severity.toLowerCase()}`}>
      <div className="ed-flag-header">
        <SeverityBadge severity={flag.severity} />
        <span className="ed-flag-title">{flag.title}</span>
      </div>
      {flag.body && <p className="ed-flag-body">{flag.body}</p>}
    </div>
  );
}

function QuestionCard({ q, index, expanded, onToggle }) {
  const hasBody = q.questionText || q.goodAnswer || q.badAnswer;

  return (
    <div
      className="ed-question-card"
      onClick={hasBody ? onToggle : undefined}
      style={{ cursor: hasBody ? 'pointer' : 'default' }}
    >
      <div className="ed-question-header">
        <span className="ed-q-num">{index + 1}</span>
        <span className="ed-q-text">{q.title}</span>
        {hasBody && <span className="ed-q-chevron">{expanded ? '▲' : '▼'}</span>}
      </div>
      {expanded && hasBody && (
        <div className="ed-question-body">
          {q.questionText && (
            <p className="ed-q-why" style={{ fontStyle: 'italic' }}>{q.questionText}</p>
          )}
          {q.goodAnswer && (
            <p className="ed-q-good"><strong>Good answer: </strong>{q.goodAnswer}</p>
          )}
          {q.badAnswer && (
            <p className="ed-q-bad"><strong>Bad answer: </strong>{q.badAnswer}</p>
          )}
        </div>
      )}
    </div>
  );
}

function NumberCard({ num }) {
  return (
    <div className="ed-number-card">
      <div className="ed-number-metric">{num.metric}</div>
      {num.body && <p className="ed-number-why">{num.body}</p>}
    </div>
  );
}

function CredTableRow({ label, detail, isLast }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      gap: 12,
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', flex: '0 0 auto', maxWidth: '55%' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>
        {detail}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function EarningsDecoder({ onSearch }) {
  const [view, setView]             = useState('input');
  const [ticker, setTicker]         = useState('');
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowT]  = useState(false);
  const [decoded, setDecoded]       = useState(null);
  const [rawTicker, setRawTicker]   = useState('');
  const [loadStep, setLoadStep]     = useState(0);
  const [doneSteps, setDoneSteps]   = useState([]);
  const [expandedQ, setExpandedQ]   = useState(null);
  const [isDownloading, setDL]      = useState(false);
  const [error, setError]           = useState('');
  const timers = useRef([]);

  useEffect(() => {
    if (view !== 'loading') return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLoadStep(0);
    setDoneSteps([]);

    let delay = 800;
    TOOL_STEPS.forEach((_, i) => {
      const t1 = setTimeout(() => setLoadStep(i), delay);
      delay += 1800 + Math.random() * 1000;
      const t2 = setTimeout(() => setDoneSteps(prev => [...prev, i]), delay - 400);
      timers.current.push(t1, t2);
    });
    return () => timers.current.forEach(clearTimeout);
  }, [view]);

  const runDecoder = async (t, tr) => {
    const sym = t.trim().toUpperCase();
    if (!sym) return;
    setError('');
    setRawTicker(sym);
    setView('loading');
    try {
      const res = await axios.post(`${API_BASE}/earnings-decoder`, {
        ticker: sym,
        transcript: tr || '',
      });
      timers.current.forEach(clearTimeout);
      const parsed = parseDecoder(res.data.decoder || '', sym);
      setDecoded(parsed);
      setView('results');
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setError(err.response?.data?.detail || err.message);
      setView('input');
    }
  };

  const handleDecode  = () => runDecoder(ticker, transcript);
  const handleChip    = sym => { setTicker(sym); runDecoder(sym, transcript); };

  const handleDownload = async () => {
    setDL(true);
    try {
      const res = await axios.post(
        `${API_BASE}/export/earnings-decoder`,
        { ticker: rawTicker, transcript },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `earnings_decoder_${rawTicker}_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
    setDL(false);
  };

  const handleFullAnalysis = () => {
    if (onSearch) onSearch(`Analyze ${rawTicker}`);
  };

  // ── INPUT STATE ────────────────────────────────────────────────────────────
  if (view === 'input') {
    return (
      <div className="ed-page">
        <div className="ed-input-view">
          <div className="ed-eyebrow">Skeptical Analysis</div>
          <h1 className="ed-title">Earnings Decoder</h1>
          <p className="ed-subtitle">
            Find the gap between what the numbers show and what management claims
          </p>
          <p className="ed-explainer">
            Most tools summarize what was said. This one finds what wasn't said — and why it matters.
          </p>

          {error && <div className="ed-error">{error}</div>}

          <div className="ed-search-row">
            <input
              className="ed-ticker-input"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleDecode()}
              placeholder="Ticker symbol, e.g. AAPL"
              maxLength={6}
              autoFocus
            />
            <button className="ed-decode-btn" onClick={handleDecode}>
              Decode Earnings
            </button>
          </div>

          <div className="ed-transcript-section">
            <button className="ed-transcript-toggle" onClick={() => setShowT(v => !v)}>
              {showTranscript ? '▲ Hide transcript input' : '▼ Add transcript for deeper analysis'}
            </button>
            {showTranscript && (
              <textarea
                className="ed-textarea"
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Paste earnings call transcript here (optional). When provided, the decoder will also analyze hedging language, deflection patterns, and topics that were avoided."
                rows={8}
              />
            )}
          </div>

          <div className="ed-chips-label">Quick decode</div>
          <div className="ed-chips">
            {QUICK_TICKERS.map(sym => (
              <button key={sym} className="ed-chip" onClick={() => handleChip(sym)}>{sym}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="ed-page">
        <div className="ed-loading-view">
          <div className="ed-loading-ticker">{rawTicker}</div>
          <div className="ed-loading-label">Running Earnings Decoder...</div>
          <div className="ed-steps">
            {TOOL_STEPS.map((msg, i) => {
              const done    = doneSteps.includes(i);
              const running = loadStep === i && !done;
              return (
                <div key={i} className={`ed-step ${done ? 'done' : running ? 'running' : 'pending'}`}>
                  <span className="ed-step-icon">{done ? '✓' : running ? '⟳' : '○'}</span>
                  <span className="ed-step-msg">{msg}</span>
                </div>
              );
            })}
          </div>
          <p className="ed-loading-note">Calling 4 analytical tools. This takes 20–40 seconds.</p>
        </div>
      </div>
    );
  }

  // ── RESULTS STATE ──────────────────────────────────────────────────────────
  if (view === 'results' && decoded) {
    const {
      isPortfolio,
      riskRating, riskBody,
      credScore, credLabel, credTableData, credBody,
      beatMissRecord, flagCount,
      summaryText,
      flags, questions, numbers,
      flagsRaw, questRaw, numsRaw,
      rawText,
    } = decoded;

    const credCls       = credColorClass(credScore);
    const riskBorderCls = riskRating === 'HIGH'   ? 'ed-border-red'
                        : riskRating === 'MEDIUM' ? 'ed-border-amber' : 'ed-border-green';

    return (
      <div className="ed-page ed-results-page">

        {/* ── Back button ───────────────────────────────────────── */}
        <div className="ed-results-topbar">
          <button className="back-btn" onClick={() => { setView('input'); setDecoded(null); }}>
            ← New Decoder
          </button>
          <span className="ed-results-ticker">{rawTicker} — Earnings Decoder</span>
        </div>

        {/* ── Row 1: 4 metric cards ─────────────────────────────── */}
        <div className="ed-metric-cards">

          <div className="metric-card">
            <div className="metric-card-label">Earnings Risk</div>
            <div className="metric-card-value">
              <RiskBadge rating={riskRating} />
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-label">Credibility Score</div>
            <div className={`metric-card-value ${credCls}`}>
              {credScore !== null ? `${credScore}/10` : 'N/A'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-label">Beat / Miss Record</div>
            <div className="metric-card-value">{beatMissRecord}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
              Last 4 quarters vs estimates
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-label">Red Flags Found</div>
            <div className={`metric-card-value ${flagCount >= 3 ? 'negative' : flagCount >= 1 ? 'ed-amber' : ''}`}>
              {flagCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
              Contradictions in guidance
            </div>
          </div>

        </div>

        {/* ── Row 2: Decoder Summary ────────────────────────────── */}
        {summaryText && (
          <div className={`ed-summary-panel ${riskBorderCls}`}>
            <div className="panel-title">Decoder Summary</div>
            <RenderText text={summaryText} />
          </div>
        )}

        {/* ── Portfolio mode: full report as readable text ─────── */}
        {isPortfolio && (
          <div className="ed-section">
            <div className="panel-title" style={{ marginBottom: 12 }}>Risk Report</div>
            <RenderText text={stripMarkdown(rawText)} />
          </div>
        )}

        {/* ── Standard mode: structured panels ─────────────────── */}
        {!isPortfolio && (
          <>
            {/* ── Row 3: Red Flags (left) + Credibility (right) ─── */}
            <div className="ed-two-col">

              <div className="ed-col-left">
                <div className="panel-title" style={{ marginBottom: 12 }}>
                  Red Flags
                  {flagCount > 0 && <span className="ed-flag-count">{flagCount}</span>}
                </div>
                {flags.length > 0
                  ? flags.map((f, i) => <FlagCard key={i} flag={f} />)
                  : flagsRaw
                    ? <RenderText text={stripMarkdown(flagsRaw)} />
                    : null
                }
              </div>

              <div className="ed-col-right">
                <div className="panel-title" style={{ marginBottom: 12 }}>Credibility Score</div>
                <div className="ed-cred-panel">
                  <div className={`ed-cred-score ${credCls}`}>
                    {credScore !== null ? `${credScore}/10` : 'N/A'}
                  </div>
                  {credLabel && <div className="ed-cred-label">{credLabel}</div>}
                  {credTableData && credTableData.length > 0 && (
                    <div style={{ marginTop: 12, textAlign: 'left' }}>
                      {credTableData.map((row, i) => (
                        <CredTableRow
                          key={i}
                          label={row.label}
                          detail={row.detail}
                          isLast={i === credTableData.length - 1}
                        />
                      ))}
                    </div>
                  )}
                  {credBody && <RenderText text={credBody} />}
                </div>
              </div>

            </div>

            {/* ── Row 4: The 6 Hard Questions ────────────────────── */}
            {(questions.length > 0 || questRaw) && (
              <div className="ed-section">
                <div className="panel-title" style={{ marginBottom: 12 }}>The 6 Hard Questions</div>
                {questions.length > 0
                  ? questions.map((q, i) => (
                    <QuestionCard
                      key={i}
                      q={q}
                      index={i}
                      expanded={expandedQ === i}
                      onToggle={() => setExpandedQ(expandedQ === i ? null : i)}
                    />
                  ))
                  : <RenderText text={stripMarkdown(questRaw)} />
                }
              </div>
            )}

            {/* ── Row 5: 3 Numbers to Watch ──────────────────────── */}
            {(numbers.length > 0 || numsRaw) && (
              <div className="ed-section">
                <div className="panel-title" style={{ marginBottom: 12 }}>3 Numbers to Watch Next Quarter</div>
                {numbers.length > 0
                  ? (
                    <div className="ed-number-cards">
                      {numbers.map((n, i) => <NumberCard key={i} num={n} />)}
                    </div>
                  )
                  : <RenderText text={stripMarkdown(numsRaw)} />
                }
              </div>
            )}
          </>
        )}

        {/* ── Risk Assessment (always shown when content exists) ── */}
        {riskBody && (
          <div className={`ed-summary-panel ${riskBorderCls}`}>
            <div className="panel-title">Risk Assessment</div>
            <RenderText text={riskBody} />
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="ed-actions">
          <button className="download-btn" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? '⏳ Generating…' : '↓ Download Decoder Report'}
          </button>
          <button className="ed-full-analysis-btn" onClick={handleFullAnalysis}>
            ▦ Run Full Stock Analysis
          </button>
        </div>

      </div>
    );
  }

  return null;
}
