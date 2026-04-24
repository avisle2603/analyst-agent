import { useState } from 'react';

const DEFAULTS = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN'];
const LS_KEY = 'analyst_watchlist';

function loadTickers() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? JSON.parse(saved) : DEFAULTS;
  } catch { return DEFAULTS; }
}

export default function WatchlistPage({ onSearch }) {
  const [tickers, setTickers] = useState(loadTickers);

  function saveTickers(next) {
    setTickers(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  }
  const [input, setInput] = useState('');

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t)) {
      saveTickers([...tickers, t]);
    }
    setInput('');
  };

  const removeTicker = (t) => saveTickers(tickers.filter(x => x !== t));

  return (
    <div className="page-view">
      <h2 className="page-title">Watchlist</h2>
      <p className="page-subtitle">Click a ticker to run a full analysis.</p>

      <div className="watchlist-grid">
        {tickers.map(t => (
          <div key={t} className="watchlist-ticker-wrap">
            <button
              className="watchlist-ticker"
              onClick={() => onSearch(`Analyze ${t}`)}
            >
              {t}
            </button>
            <button
              className="watchlist-remove"
              onClick={() => removeTicker(t)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="watchlist-add-row">
        <input
          className="search-input"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') addTicker(); }}
          placeholder="Add ticker…"
          maxLength={6}
          style={{ maxWidth: 180 }}
        />
        <button className="search-btn" onClick={addTicker}>Add</button>
      </div>
    </div>
  );
}
