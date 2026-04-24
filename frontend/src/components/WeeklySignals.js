import { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const SIG_COLOR  = { BUY: '#1D9E75', HOLD: '#EF9F27', SELL: '#E24B4A' };
const SIG_BG     = { BUY: '#0f3d2a', HOLD: '#3d2a0f', SELL: '#3d0f0f' };

function fmt(v, decimals = 1) {
  if (v == null) return null;
  return parseFloat(v).toFixed(decimals);
}

function fmtPct(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function fmtPrice(v) {
  if (v == null) return null;
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Score breakdown helper ────────────────────────────────────────────────────
function scoreBreakdown(stock) {
  const rows = [];
  const { revenue_growth, upside_to_target, gross_margin, pe_ratio, price_change_3m, price, week_52_high } = stock;

  if (revenue_growth != null) {
    if (revenue_growth > 20)      rows.push({ pts: +25, text: `Revenue growth above 20%` });
    else if (revenue_growth > 10) rows.push({ pts: +15, text: `Revenue growth above 10%` });
    else if (revenue_growth < 0)  rows.push({ pts: -20, text: `Revenue declining` });
  }
  if (upside_to_target != null) {
    if (upside_to_target > 20)      rows.push({ pts: +25, text: `Analyst upside above 20%` });
    else if (upside_to_target > 10) rows.push({ pts: +15, text: `Analyst upside above 10%` });
    else if (upside_to_target < 0)  rows.push({ pts: -25, text: `Trading above analyst target` });
  }
  if (gross_margin != null) {
    if (gross_margin > 60)      rows.push({ pts: +15, text: `Gross margin above 60%` });
    else if (gross_margin > 40) rows.push({ pts: +10, text: `Gross margin above 40%` });
    else if (gross_margin < 20) rows.push({ pts: -10, text: `Gross margin below 20%` });
  }
  if (pe_ratio != null) {
    if (pe_ratio < 15)      rows.push({ pts: +15, text: `Attractive valuation (P/E below 15x)` });
    else if (pe_ratio < 25) rows.push({ pts:  +5, text: `Reasonable valuation (P/E below 25x)` });
    else if (pe_ratio > 50) rows.push({ pts: -10, text: `Expensive valuation (P/E above 50x)` });
  }
  if (price_change_3m != null) {
    if (price_change_3m > 15)       rows.push({ pts: +10, text: `Strong momentum (+15% in 3 months)` });
    else if (price_change_3m < -15) rows.push({ pts: -15, text: `Weak momentum (-15% in 3 months)` });
  }
  if (price && week_52_high) {
    const pct = (price - week_52_high) / week_52_high * 100;
    if (pct > -10)       rows.push({ pts: +5, text: `Near 52-week high` });
    else if (pct < -30)  rows.push({ pts: -5, text: `Far below 52-week high` });
  }
  return rows;
}

// ─── Stock Card ───────────────────────────────────────────────────────────────
function StockCard({ stock, onRunAnalysis, onAddWatchlist }) {
  const [expanded, setExpanded] = useState(false);
  const [watchAdded, setWatchAdded] = useState(false);

  const sig   = stock.signal;
  const color = SIG_COLOR[sig] || '#94a3b8';
  const bg    = SIG_BG[sig]   || '#1a1f2e';

  function handleAddWatchlist(e) {
    e.stopPropagation();
    try {
      const raw = localStorage.getItem('analyst_watchlist');
      const wl  = raw ? JSON.parse(raw) : ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN'];
      if (!wl.includes(stock.ticker)) {
        localStorage.setItem('analyst_watchlist', JSON.stringify([...wl, stock.ticker]));
      }
    } catch {}
    setWatchAdded(true);
    setTimeout(() => setWatchAdded(false), 2000);
  }

  const breakdown = scoreBreakdown(stock);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: '#161b27',
        border: `1px solid ${expanded ? color : '#2d3748'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {/* ROW 1 — Signal badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          background: bg, color, fontSize: '0.7rem', fontWeight: 700,
          padding: '2px 8px', borderRadius: 4,
        }}>
          {sig}
        </span>
        {stock.conviction && (
          <span style={{
            border: `1px solid ${color}`, color, fontSize: '0.65rem', fontWeight: 600,
            padding: '1px 6px', borderRadius: 4, opacity: 0.8,
          }}>
            {stock.conviction}
          </span>
        )}
      </div>

      {/* ROW 2 — Ticker and price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{stock.ticker}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
            {fmtPrice(stock.price) || '—'}
          </div>
          {stock.price_change_3m != null && (
            <div style={{
              fontSize: 11, marginTop: 2,
              color: stock.price_change_3m >= 0 ? '#1D9E75' : '#E24B4A',
            }}>
              {fmtPct(stock.price_change_3m)}
            </div>
          )}
        </div>
      </div>

      {/* ROW 3 — Metric chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          {
            label: 'UPSIDE',
            value: stock.upside_to_target,
            render: v => ({
              text: fmtPct(v),
              color: v >= 0 ? '#1D9E75' : '#E24B4A',
            }),
          },
          {
            label: 'REV GROWTH',
            value: stock.revenue_growth,
            render: v => ({
              text: fmtPct(v),
              color: v >= 0 ? '#1D9E75' : '#E24B4A',
            }),
          },
          {
            label: 'P/E RATIO',
            value: stock.pe_ratio,
            render: v => ({ text: fmt(v, 1) + 'x', color: '#e2e8f0' }),
          },
        ].map(({ label, value, render }) => {
          const rendered = value != null ? render(value) : null;
          return (
            <div key={label} style={{
              flex: 1, background: '#0f1117', borderRadius: 6,
              padding: '6px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: rendered ? rendered.color : '#475569' }}>
                {rendered ? rendered.text : 'N/A'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ROW 4 — Reasons */}
      <div style={{ marginBottom: 8 }}>
        {stock.reasons_buy[0] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80', marginBottom: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {stock.reasons_buy[0]}
            </span>
          </div>
        )}
        {stock.reasons_risk[0] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f87171' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E24B4A', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {stock.reasons_risk[0]}
            </span>
          </div>
        )}
      </div>

      {/* ROW 5 — Summary */}
      <div style={{
        fontSize: 11, color: '#94a3b8', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {stock.summary}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, borderTop: '1px solid #2d3748', paddingTop: 16 }}>
          {/* Full metrics table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 16 }}>
            {[
              ['Price',           fmtPrice(stock.price)],
              ['Analyst Target',  fmtPrice(stock.analyst_target)],
              ['Upside',          fmtPct(stock.upside_to_target)],
              ['52-Week High',    fmtPrice(stock.week_52_high)],
              ['52-Week Low',     fmtPrice(stock.week_52_low)],
              ['Revenue Growth',  stock.revenue_growth != null ? fmtPct(stock.revenue_growth) : null],
              ['Gross Margin',    stock.gross_margin != null ? fmt(stock.gross_margin, 1) + '%' : null],
              ['P/E Ratio',       stock.pe_ratio != null ? fmt(stock.pe_ratio, 1) + 'x' : null],
              ['Dividend Yield',  stock.dividend_yield != null ? fmt(stock.dividend_yield, 2) + '%' : null],
              ['Beta',            stock.beta != null ? fmt(stock.beta, 2) : null],
              ['3M Change',       stock.price_change_3m != null ? fmtPct(stock.price_change_3m) : null],
              ['Signal Score',    stock.score + ' / 100'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a2234', paddingBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Score breakdown */}
          {breakdown.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Why this score
              </div>
              {breakdown.map((row, i) => (
                <div key={i} style={{
                  fontSize: 11, color: row.pts >= 0 ? '#4ade80' : '#f87171',
                  marginBottom: 3,
                }}>
                  {row.pts >= 0 ? '+' : ''}{row.pts} pts — {row.text}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onRunAnalysis(stock.ticker)}
              style={{
                flex: 1, background: '#1D9E75', color: '#fff',
                border: 'none', borderRadius: 6, padding: '8px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Run Full Analysis
            </button>
            <button
              onClick={handleAddWatchlist}
              style={{
                flex: 1, background: 'transparent',
                color: watchAdded ? '#1D9E75' : '#94a3b8',
                border: `1px solid ${watchAdded ? '#1D9E75' : '#2d3748'}`,
                borderRadius: 6, padding: '8px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {watchAdded ? 'Added!' : 'Add to Watchlist'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WeeklySignals({ onSearch, onDownload }) {
  const [state, setState]     = useState('ready');   // ready | loading | results
  const [data, setData]       = useState(null);
  const [filter, setFilter]   = useState('ALL');
  const [sort, setSort]       = useState('score');
  const [isDownloading, setDownloading] = useState(false);

  async function runScreen() {
    setState('loading');
    try {
      const res = await axios.post(`${API_BASE}/weekly-signals`, {}, { timeout: 120000 });
      setData(res.data);
      setFilter('ALL');
      setState('results');
    } catch (err) {
      setState('ready');
      alert('Screen failed: ' + (err.response?.data?.detail || err.message));
    }
  }

  function handleRunAnalysis(ticker) {
    onSearch(ticker);
  }

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);

    const buys  = data.stocks.filter(s => s.signal === 'BUY');
    const holds = data.stocks.filter(s => s.signal === 'HOLD');
    const sells = data.stocks.filter(s => s.signal === 'SELL');

    const section = (stocks) => stocks.map(s =>
      `${s.ticker} — ${s.name}\n` +
      `Price: ${fmtPrice(s.price) || 'N/A'} | Upside: ${fmtPct(s.upside_to_target) || 'N/A'} | Revenue Growth: ${fmtPct(s.revenue_growth) || 'N/A'}\n` +
      (s.reasons_buy[0]  ? `Strength: ${s.reasons_buy[0]}\n`  : '') +
      (s.reasons_risk[0] ? `Risk: ${s.reasons_risk[0]}\n`     : '') +
      s.summary
    ).join('\n\n');

    const brief = [
      `## Weekly Stock Signals — ${data.generated_at}`,
      '',
      '## Buy Signals',
      section(buys),
      '',
      '## Hold Signals',
      section(holds),
      '',
      '## Sell Signals',
      section(sells),
      '',
      '## Disclaimer',
      'This report is generated from publicly available data via Yahoo Finance. Not financial advice.',
    ].join('\n');

    try {
      const res = await axios.post(
        `${API_BASE}/export/docx`,
        { query: brief },
        { responseType: 'blob', timeout: 60000 }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly_signals_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
    setDownloading(false);
  }

  // ── Filtered + sorted stocks ──
  let stocks = data ? [...data.stocks] : [];
  if (filter !== 'ALL') stocks = stocks.filter(s => s.signal === filter);

  if (sort === 'upside') {
    stocks.sort((a, b) => (b.upside_to_target ?? -999) - (a.upside_to_target ?? -999));
  } else if (sort === 'revenue') {
    stocks.sort((a, b) => (b.revenue_growth ?? -999) - (a.revenue_growth ?? -999));
  } else if (sort === 'pe') {
    stocks.sort((a, b) => (a.pe_ratio ?? 999) - (b.pe_ratio ?? 999));
  } else {
    // Default: score, but BUY > HOLD > SELL
    const sigOrder = { BUY: 0, HOLD: 1, SELL: 2 };
    stocks.sort((a, b) => {
      const sDiff = (sigOrder[a.signal] ?? 1) - (sigOrder[b.signal] ?? 1);
      if (sDiff !== 0) return sDiff;
      return b.score - a.score;
    });
  }

  const counts = data
    ? { BUY: data.buy_count, HOLD: data.hold_count, SELL: data.sell_count }
    : { BUY: 0, HOLD: 0, SELL: 0 };

  // ── Shared container style ──
  const page = {
    padding: '32px 40px',
    maxWidth: 1100,
    margin: '0 auto',
    color: '#e2e8f0',
    fontFamily: 'inherit',
  };

  // ── Ready state ──
  if (state === 'ready') {
    return (
      <div style={page}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0' }}>Weekly Signals</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            Live stock screen across 20 securities
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, margin: '32px 0' }}>
          {[
            ['20 stocks screened', '◈'],
            ['Live data via Yahoo Finance', '◉'],
            ['Updated on demand', '▦'],
          ].map(([text, icon]) => (
            <div key={text} style={{
              flex: 1, background: '#161b27', border: '1px solid #2d3748',
              borderRadius: 10, padding: '18px 20px',
              fontSize: 13, color: '#94a3b8',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ color: '#1D9E75', fontSize: 16 }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button
            onClick={runScreen}
            style={{
              background: '#1D9E75', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '14px 40px', fontSize: 15,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Run Screen
          </button>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
            Takes 30-60 seconds to fetch live data for all stocks
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (state === 'loading') {
    return (
      <div style={{ ...page, textAlign: 'center', paddingTop: 80 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: '3px solid #2d3748',
          borderTopColor: '#1D9E75',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 24px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
          Screening 20 stocks...
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Fetching live prices, margins, analyst targets, and momentum data
        </div>
      </div>
    );
  }

  // ── Results state ──
  return (
    <div style={page}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>Weekly Signals</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{data.generated_at}</div>
        </div>
        <button
          onClick={runScreen}
          style={{
            background: 'transparent', color: '#94a3b8',
            border: '1px solid #2d3748', borderRadius: 6,
            padding: '7px 14px', fontSize: 12, cursor: 'pointer',
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Buy signals',  count: counts.BUY,  color: SIG_COLOR.BUY },
          { label: 'Hold',         count: counts.HOLD, color: SIG_COLOR.HOLD },
          { label: 'Sell or avoid',count: counts.SELL, color: SIG_COLOR.SELL },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            flex: 1, background: '#161b27', border: '1px solid #2d3748',
            borderRadius: 10, padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color }}>{count}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter + sort bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['ALL', 'BUY', 'HOLD', 'SELL'].map(f => {
            const active  = filter === f;
            const fColor  = f === 'ALL' ? '#1D9E75' : SIG_COLOR[f];
            const ct      = f === 'ALL' ? data.stocks.length : counts[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: active ? fColor : 'transparent',
                  color:      active ? '#fff' : '#94a3b8',
                  border:     `1px solid ${active ? fColor : '#2d3748'}`,
                  borderRadius: 20, padding: '5px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {f} ({ct})
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Sort:</span>
          {[
            { key: 'score',   label: 'Score' },
            { key: 'upside',  label: 'Upside' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'pe',      label: 'P/E' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              style={{
                background: sort === key ? '#1a2234' : 'transparent',
                color:      sort === key ? '#e2e8f0' : '#64748b',
                border:     `1px solid ${sort === key ? '#2d3748' : 'transparent'}`,
                borderRadius: 4, padding: '3px 8px',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {stocks.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            onRunAnalysis={handleRunAnalysis}
            onAddWatchlist={() => {}}
          />
        ))}
      </div>

      {/* Download button */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            background: isDownloading ? '#2d3748' : '#161b27',
            color: isDownloading ? '#64748b' : '#94a3b8',
            border: '1px solid #2d3748', borderRadius: 8,
            padding: '10px 28px', fontSize: 13,
            fontWeight: 600, cursor: isDownloading ? 'default' : 'pointer',
          }}
        >
          {isDownloading ? 'Generating...' : 'Download Signals Report'}
        </button>
      </div>

      {/* Disclaimer */}
      <div style={{
        fontSize: 11, color: '#475569', textAlign: 'center',
        borderTop: '1px solid #1a2234', paddingTop: 20,
        lineHeight: 1.6, maxWidth: 700, margin: '0 auto',
      }}>
        Signal scores are calculated from live financial data via Yahoo Finance.
        This is not financial advice. Scores are based on quantitative factors only
        and do not constitute a recommendation to buy or sell any security.
        Always conduct your own research.
      </div>
    </div>
  );
}
