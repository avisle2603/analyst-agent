import React, { useState } from 'react'
import Dashboard from './Dashboard'
import WeeklySignals from './WeeklySignals'
import Portfolio from './Portfolio'
import Watchlist from './Watchlist'
import EarningsDecoder from './EarningsDecoder'
import EarningsPrep from './EarningsPrep'
import Reports from './Reports'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [pendingQuery, setPendingQuery] = useState(null)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'signals',   label: 'Weekly Signals', badge: 'LIVE' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'earnings',  label: 'Earnings Decoder', badge: 'NEW' },
    { id: 'prep',      label: 'Earnings Prep' },
    { id: 'reports',   label: 'Reports' },
  ]

  const goToAnalysis = (ticker) => {
    setPendingQuery('Analyze ' + ticker)
    setActivePage('dashboard')
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            pendingQuery={pendingQuery}
            onQueryConsumed={() => setPendingQuery(null)}
          />
        )
      case 'signals':
        return <WeeklySignals onRunAnalysis={goToAnalysis} />
      case 'portfolio':
        return <Portfolio />
      case 'watchlist':
        return <Watchlist onAnalyze={goToAnalysis} />
      case 'earnings':
        return <EarningsDecoder onRunAnalysis={goToAnalysis} />
      case 'prep':
        return <EarningsPrep />
      case 'reports':
        return <Reports />
      default:
        return (
          <Dashboard
            pendingQuery={pendingQuery}
            onQueryConsumed={() => setPendingQuery(null)}
          />
        )
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div style={{
        width: '220px',
        background: '#161b27',
        borderRight: '1px solid #2d3748',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          padding: '8px 10px 16px',
          borderBottom: '1px solid #2d3748',
          marginBottom: '8px',
        }}>
          <span style={{ color: '#e2e8f0' }}>Analyst</span>
          <span style={{ color: '#1D9E75' }}>Agent</span>
        </div>

        {navItems.map(item => (
          <div
            key={item.id}
            onClick={() => setActivePage(item.id)}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: activePage === item.id ? 'rgba(29,158,117,0.12)' : 'transparent',
              color: activePage === item.id ? '#1D9E75' : '#94a3b8',
              borderLeft: activePage === item.id ? '2px solid #1D9E75' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '99px',
                background: '#0f3d2a',
                color: '#1D9E75',
                fontWeight: '600',
              }}>
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div style={{
        marginLeft: '220px',
        flex: 1,
        minHeight: '100vh',
        background: '#0f1117',
      }}>
        {renderPage()}
      </div>
    </div>
  )
}
