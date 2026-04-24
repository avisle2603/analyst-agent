const NAV = [
  { icon: '▦', label: 'dashboard',         display: 'Dashboard' },
  { icon: '◉', label: 'weekly-signals',    display: 'Weekly Signals', badge: 'LIVE' },
  { icon: '◈', label: 'portfolio',         display: 'Portfolio' },
  { icon: '◎', label: 'watchlist',         display: 'Watchlist' },
  { icon: '⚑', label: 'earnings-decoder', display: 'Earnings Decoder', badge: 'NEW' },
  { icon: '▤', label: 'reports',           display: 'Reports' },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        Analyst<span>Agent</span>
      </div>

      <div className="sidebar-section-label">Navigation</div>

      <nav className="sidebar-nav">
        {NAV.map(({ icon, label, display, badge }) => (
          <button
            key={label}
            className={`nav-item ${activePage === label ? 'active' : ''}`}
            onClick={() => onNavigate(label)}
          >
            <span className="nav-icon">{icon}</span>
            {display}
            {badge && (
              <span style={{
                marginLeft: 'auto',
                background: badge === 'LIVE' ? 'rgba(29,158,117,0.2)' : 'rgba(245,158,11,0.2)',
                color: badge === 'LIVE' ? '#1D9E75' : '#f59e0b',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                letterSpacing: '0.05em',
              }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        Powered by Claude
      </div>
    </aside>
  );
}
