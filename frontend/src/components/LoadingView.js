
function StatusIcon({ status }) {
  if (status === 'done')    return <span className="tool-status-icon" style={{ color: '#1D9E75' }}>✓</span>;
  if (status === 'running') return <span className="tool-status-icon" style={{ color: '#e2e8f0', display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>;
  return <span className="tool-status-icon" style={{ opacity: 0.35 }}>○</span>;
}

export default function LoadingView({ toolLog }) {
  const doneCount = toolLog.filter(t => t.status === 'done').length;

  return (
    <div className="loading-view">
      <div className="spinner" />
      <div className="loading-label">Agent is running…</div>

      <div className="tool-log">
        <div className="tool-log-header">
          <span className="tool-log-title">Tool Execution</span>
          {doneCount > 0 && (
            <span className="tool-log-count">{doneCount} / {toolLog.length} done</span>
          )}
        </div>

        {toolLog.map(({ name, status }) => (
          <div key={name} className={`tool-log-item ${status}`}>
            <StatusIcon status={status} />
            <span>{name}</span>
            <span className={`tool-status-label ${status}`}>
              {status === 'done'
                ? 'done'
                : status === 'running'
                  ? 'running…'
                  : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
