import { useState } from 'react';

const EXAMPLES = [
  'SCHD 40%, SGOV 30%, VNQ 30%',
  'AAPL 25%, MSFT 25%, NVDA 25%, AMZN 25%',
  'VTI 60%, BND 30%, GLD 10%',
];

export default function PortfolioPage({ onSearch }) {
  const [input, setInput] = useState('');

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    onSearch(`Check my portfolio risk: ${q}`);
  };

  return (
    <div className="page-view">
      <h2 className="page-title">Portfolio Risk Check</h2>
      <p className="page-subtitle">
        Enter your holdings with weights to analyze concentration and sector risk.
      </p>

      <textarea
        className="holdings-input"
        rows={4}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit(); }}
        placeholder="e.g. SCHD 40%, SGOV 30%, VNQ 30%"
        autoFocus
      />

      <button className="search-btn" onClick={submit} style={{ width: '100%' }}>
        Analyze Portfolio →
      </button>

      <div style={{ marginTop: 28 }}>
        <div className="page-subtitle" style={{ marginBottom: 10 }}>Quick examples</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              className="chip"
              style={{ textAlign: 'left', borderRadius: 8, padding: '9px 14px' }}
              onClick={() => setInput(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
