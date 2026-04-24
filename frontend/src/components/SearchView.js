
const TICKERS = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META'];

export default function SearchView({ query, setQuery, onSearch }) {
  const handleKey = e => {
    if (e.key === 'Enter') onSearch(query);
  };

  const pickTicker = ticker => {
    const q = `Analyze ${ticker}`;
    setQuery(q);
    onSearch(q);
  };

  return (
    <div className="search-view">
      <div>
        <div className="search-eyebrow">AI-Powered Financial Analysis</div>
        <h1 className="search-title">
          Your <span>AI Analyst</span>
        </h1>
        <p className="search-subtitle">
          Enter a stock ticker or company name to get a full investment analysis
        </p>
      </div>

      <div>
        <div className="search-box">
          <input
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Enter a ticker or company name... e.g. NVDA, Apple, Tesla"
            autoFocus
          />
          <button className="search-btn" onClick={() => onSearch(query)}>
            Analyze Stock
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--muted)', opacity: 0.7 }}>
          Try: NVDA · AAPL · TSLA · or any company name
        </p>
      </div>

      <div>
        <div className="chips-label" style={{ marginBottom: 10 }}>
          Popular stocks
        </div>
        <div className="chips">
          {TICKERS.map(ticker => (
            <button key={ticker} className="chip" onClick={() => pickTicker(ticker)}>
              {ticker}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
