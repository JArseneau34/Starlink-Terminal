interface SatStatsToolbarProps {
  status: string;
  busy: boolean;
  bootstrapDone: boolean;
  launchCount: number;
  snapshotId: number | null;
  onUpdate: () => void;
  onRefresh: () => void;
  onBootstrap: (force?: boolean) => void;
  onApproveAll: () => void;
  onTrueUp: () => void;
  onPublishCsv: () => void;
  onPublish: () => void;
  onResetZoom: () => void;
}

export function SatStatsToolbar({
  status,
  busy,
  bootstrapDone,
  launchCount,
  snapshotId,
  onUpdate,
  onRefresh,
  onBootstrap,
  onApproveAll,
  onTrueUp,
  onPublishCsv,
  onPublish,
  onResetZoom,
}: SatStatsToolbarProps) {
  return (
    <div className="starlink-inv-block sat-stats-toolbar">
      <div className="sat-stats-section-head">
        <div>
          <div className="mesh-overlay-label">Data pipeline</div>
          <p className="starlink-inv-block-desc">
            Ingest · review · compute · publish — same flow as Space-Industry-Data-Pipeline
          </p>
        </div>
        <span className={`starlink-inv-badge ${busy ? 'starlink-inv-badge--estimate' : 'starlink-inv-badge--live'}`}>
          {busy ? 'working' : 'ready'}
        </span>
      </div>
      <div className="sat-stats-toolbar-actions">
        <button type="button" className="mesh-toggle mesh-toggle-on" disabled={busy} onClick={onUpdate}>
          update
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onRefresh}>
          refresh
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={busy || bootstrapDone}
          onClick={() => onBootstrap(false)}
          title={bootstrapDone ? `Completed · ${launchCount} launches in archive` : undefined}
        >
          {bootstrapDone ? `wiki bootstrap ✓ (${launchCount})` : 'bootstrap wiki'}
        </button>
        {bootstrapDone && (
          <button type="button" className="mesh-toggle" disabled={busy} onClick={() => onBootstrap(true)}>
            force bootstrap
          </button>
        )}
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onTrueUp} title="Wikipedia launch counts + FCC deorbited apportionment — queues one bulk review">
          seed true-up
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onApproveAll}>
          approve all
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={busy || snapshotId == null}
          onClick={onPublishCsv}
        >
          publish csv
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={busy || snapshotId == null}
          onClick={onPublish}
        >
          publish feeds
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onResetZoom}>
          reset zoom
        </button>
      </div>
      <div className="sat-stats-status" title={status}>
        {status}
      </div>
    </div>
  );
}
