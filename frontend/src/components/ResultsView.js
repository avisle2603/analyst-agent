
// ─── Markdown stripper ───────────────────────────────────────────────────────
function stripMd(s) {
  return s
    .replace(/\*\*([^*]*)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]*)\*/g, '$1')       // *italic*
    .replace(/`([^`]*)`/g, '$1')         // `code`
    .replace(/N\/A/g, '—')
    .trim();
}

// ─── SectionText ─────────────────────────────────────────────────────────────
// Renders section content cleanly — no raw markdown ever reaches the DOM.
function SectionText({ text }) {
  if (!text) return null;
  const elements = [];

  for (const [i, line] of text.split('\n').entries()) {
    const t = line.trim();

    // Empty → small spacer
    if (!t) {
      elements.push(<div key={i} className="sec-spacer" />);
      continue;
    }

    // Horizontal rules (--- / === / ***) → skip entirely
    if (/^[-=*]{3,}$/.test(t)) continue;

    // Markdown headings (##, ###) → skip; shouldn't appear in section body
    if (/^#{1,6}\s/.test(t)) continue;

    // Table separator rows (|---|---| or |:---:|) → skip
    if (/^\|[\s|:\-]+$/.test(t)) continue;

    // Table rows
    if (t.startsWith('|')) {
      const cells = t.split('|').map(c => stripMd(c)).filter(c => c.length > 0);
      if (cells.length >= 2) {
        // Header detection: if joined cells contain no digits, $, %, or +/-
        // it's a label row (e.g. "| Metric | Value |"), not a data row.
        const joined = cells.join('');
        if (!/[\d$%+]/.test(joined)) continue;

        elements.push(
          <div key={i} className="sec-row">
            <span className="sec-row-label">{cells[0]}</span>
            <span className="sec-row-value">{cells[1]}</span>
          </div>
        );
      }
      // Any unparseable table line is silently dropped — never shown raw
      continue;
    }

    // Blockquote (> text) → render as subtle italic note, strip the >
    if (t.startsWith('>')) {
      const content = stripMd(t.replace(/^>\s*/, ''));
      if (content) elements.push(<p key={i} className="sec-line sec-quote">{content}</p>);
      continue;
    }

    // Bullet: - text / * text / • text
    if (/^[-*•]\s+\S/.test(t)) {
      const content = stripMd(t.replace(/^[-*•]\s+/, ''));
      elements.push(
        <div key={i} className="sec-bullet">
          <span className="sec-bullet-dot">•</span>
          <span>{content}</span>
        </div>
      );
      continue;
    }

    // Numbered list: 1. text
    const numM = t.match(/^(\d+)\.\s+(.+)$/);
    if (numM) {
      elements.push(
        <div key={i} className="sec-bullet">
          <span className="sec-bullet-dot">{numM[1]}.</span>
          <span>{stripMd(numM[2])}</span>
        </div>
      );
      continue;
    }

    // Plain text — strip all remaining markdown
    const clean = stripMd(t);
    if (clean) elements.push(<p key={i} className="sec-line">{clean}</p>);
  }

  return <div className="sec-text">{elements}</div>;
}

// ─── Rec badge ───────────────────────────────────────────────────────────────
function RecBadge({ rec }) {
  const cls = rec.includes('BUY') ? 'buy' : rec === 'SELL' ? 'sell' : 'hold';
  return <span className={`rec-badge ${cls}`}>{rec}</span>;
}

// ─── Sentiment badge ─────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }) {
  return <span className={`sentiment-badge ${sentiment}`}>{sentiment}</span>;
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, colorClass }) {
  return (
    <div className="metric-card">
      <div className="metric-card-label">{label}</div>
      <div className={`metric-card-value ${colorClass || ''}`}>{value || '—'}</div>
    </div>
  );
}

// ─── Top bar (shared) ─────────────────────────────────────────────────────────
function TopBar({ query, onNewSearch, onDownload, isDownloading }) {
  return (
    <div className="results-header">
      <div className="results-nav">
        <button className="back-btn" onClick={onNewSearch}>← New Search</button>
        <span className="results-query" title={query}>{query}</span>
      </div>
      <button className="download-btn" onClick={onDownload} disabled={isDownloading}>
        {isDownloading ? '⏳ Generating…' : '↓ Download Report'}
      </button>
    </div>
  );
}

// ─── Portfolio / Report Mode (Fix 5) ─────────────────────────────────────────
function PortfolioReport({ parsed, query, onNewSearch, onDownload, isDownloading }) {
  const sections = [];
  let current = null;

  for (const line of parsed.raw.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.+)$/);
    if (h) {
      if (current) sections.push(current);
      const heading = h[1]
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/\*+/g, '')
        .replace(/^\d+\.\s*/, '')
        .trim();
      current = { heading, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return (
    <div>
      <TopBar
        query={query}
        onNewSearch={onNewSearch}
        onDownload={onDownload}
        isDownloading={isDownloading}
      />
      <div className="report-body">
        {sections.map((sec, i) => (
          <div key={i} className="report-section">
            {sec.heading && (
              <div className="report-section-heading">{sec.heading}</div>
            )}
            <SectionText text={sec.lines.join('\n').trim()} />
          </div>
        ))}

        {parsed.toolsUsed && parsed.toolsUsed.length > 0 && (
          <div className="tool-chips-panel">
            <div className="panel-title">Tools Called</div>
            <div className="tool-chips">
              {parsed.toolsUsed.map((t, i) => (
                <span key={i} className="tool-chip">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────
export default function ResultsView({ parsed, query, onNewSearch, onDownload, isDownloading }) {
  const {
    ticker, company, price, peRatio, targetPrice, upside,
    recommendation, sections, newsItems, overallSentiment,
    toolsUsed,
  } = parsed;

  // Portfolio / report mode (Fix 5)
  if (parsed.isPortfolio) {
    return (
      <PortfolioReport
        parsed={parsed}
        query={query}
        onNewSearch={onNewSearch}
        onDownload={onDownload}
        isDownloading={isDownloading}
      />
    );
  }

  // Helper: find section content by partial key match
  function getSec(...frags) {
    for (const frag of frags) {
      const k = Object.keys(sections).find(k => k.includes(frag));
      if (k) return sections[k];
    }
    return '';
  }

  const summaryText = getSec('summary', 'overview', 'executive');
  const metricsText = getSec('key metric', 'financial metric', 'fundamental');
  const trendText   = getSec('technical', 'trend analysis', 'trend', 'momentum');
  const riskText    = getSec('investment risk', 'risk factor', 'risk assessment', 'risk');

  // Recommendation: search broadly, then fall back to the last non-empty section
  let recText = getSec('recommendation', 'verdict', 'conclusion', 'final', 'buy', 'sell', 'hold');
  if (!recText) {
    const sectionKeys = Object.keys(sections).filter(k => k !== '_intro' && sections[k]);
    recText = sectionKeys.length > 0 ? sections[sectionKeys[sectionKeys.length - 1]] : '';
  }

  // Upside colour
  const upsideVal = upside ? parseFloat(upside) : null;
  const upsideClass = upsideVal !== null ? (upsideVal >= 0 ? 'positive' : 'negative') : '';
  const upsideDisplay = upsideVal !== null
    ? `${upsideVal >= 0 ? '+' : ''}${upsideVal}%`
    : '—';

  return (
    <div>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <TopBar
        query={query}
        onNewSearch={onNewSearch}
        onDownload={onDownload}
        isDownloading={isDownloading}
      />

      {/* ── Ticker header ────────────────────────────────────────────────────── */}
      <div className="ticker-header">
        <div className="ticker-left">
          <div className="ticker-symbol">{ticker || '—'}</div>
          {company && company !== ticker && (
            <div className="ticker-name">{company}</div>
          )}
        </div>
        {price != null && (
          <div className="ticker-price">
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
        <RecBadge rec={recommendation} />
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────────── */}
      <div className="metric-cards">
        <MetricCard
          label="Current Price"
          value={price != null
            ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : null}
        />
        <MetricCard
          label="P/E Ratio"
          value={peRatio ? `${peRatio}x` : null}
        />
        <MetricCard
          label="Analyst Target"
          value={targetPrice != null
            ? `$${targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : null}
        />
        <MetricCard
          label="Upside"
          value={upsideDisplay}
          colorClass={upsideClass}
        />
      </div>

      {/* ── Summary paragraph ────────────────────────────────────────────────── */}
      {summaryText && (
        <div className="summary-para">
          <SectionText text={summaryText} />
        </div>
      )}

      {/* ── Two-col: Key Metrics + News ──────────────────────────────────────── */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Key Metrics</div>
          <SectionText text={metricsText} />
        </div>

        <div className="panel">
          <div className="panel-title">
            Recent News
            <SentimentBadge sentiment={overallSentiment} />
          </div>
          {newsItems.length > 0 ? (
            <div className="news-list">
              {newsItems.map((item, i) => (
                <div key={i} className="news-item">
                  <SentimentBadge sentiment={item.sentiment} />
                  <span className="news-text">{item.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="news-empty">No headlines extracted.</p>
          )}
        </div>
      </div>

      {/* ── Recommendation box ───────────────────────────────────────────────── */}
      <div className="rec-box">
        <div className="rec-box-title">Recommendation</div>
        <div className="rec-box-text">
          <SectionText text={recText || 'See full brief for details.'} />
        </div>
      </div>

      {/* ── Trend Analysis ───────────────────────────────────────────────────── */}
      {trendText && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">Trend Analysis</div>
          <SectionText text={trendText} />
        </div>
      )}

      {/* ── Risk Assessment ──────────────────────────────────────────────────── */}
      {riskText && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">Risk Assessment</div>
          <SectionText text={riskText} />
        </div>
      )}

      {/* ── Tools called ─────────────────────────────────────────────────────── */}
      {toolsUsed.length > 0 && (
        <div className="tool-chips-panel">
          <div className="panel-title">Tools Called</div>
          <div className="tool-chips">
            {toolsUsed.map((t, i) => (
              <span key={i} className="tool-chip">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
