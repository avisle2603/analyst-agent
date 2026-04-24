import { useState } from 'react';

function formatTimestamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ReportsPage({ reports, setReports, onDownload }) {
  const [expanded, setExpanded] = useState(null);

  const clearAll = () => {
    if (window.confirm('Clear all saved reports?')) {
      setReports([]);
    }
  };

  if (reports.length === 0) {
    return (
      <div className="page-view">
        <h2 className="page-title">Reports</h2>
        <p className="page-subtitle">
          No analyses run yet. Go to Dashboard and run a query — your reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="page-view" style={{ maxWidth: 860 }}>
      <div className="reports-page-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>Reports</h2>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button className="back-btn" onClick={clearAll}>Clear All</button>
      </div>

      <div className="reports-list" style={{ marginTop: 20 }}>
        {reports.map((report, i) => (
          <div key={i} className="report-card">
            <div className="report-card-header">
              <div className="report-meta">
                <div className="report-query">{report.query}</div>
                <div className="report-time">{formatTimestamp(report.timestamp)}</div>
              </div>
              <div className="report-actions">
                <button
                  className="back-btn"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  {expanded === i ? 'Hide' : 'View'}
                </button>
                <button
                  className="download-btn"
                  onClick={() => onDownload(report.query)}
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  ↓ Download
                </button>
              </div>
            </div>

            {expanded === i && report.result && (
              <div className="report-expanded">
                <pre className="report-raw">{report.result}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
