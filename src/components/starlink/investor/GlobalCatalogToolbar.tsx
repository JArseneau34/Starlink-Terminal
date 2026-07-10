interface GlobalCatalogToolbarProps {
  status: string;
  busy: boolean;
  bootstrapDone: boolean;
  launchCount: number;
  satelliteCount: number;
  viewScope: 'orbital' | 'all';
  satKind: 'payloads' | 'non_payloads';
  onViewScopeChange: (scope: 'orbital' | 'all') => void;
  onSatKindChange: (kind: 'payloads' | 'non_payloads') => void;
  onUpdate: () => void;
  onRefresh: () => void;
  onBootstrap: (force?: boolean) => void;
  onApproveAll: () => void;
  onPublishCsv: () => void;
  onPublishApi: () => void;
  onResetZoom: () => void;
}

export function GlobalCatalogToolbar({
  status,
  busy,
  bootstrapDone,
  launchCount,
  satelliteCount,
  viewScope,
  satKind,
  onViewScopeChange,
  onSatKindChange,
  onUpdate,
  onRefresh,
  onBootstrap,
  onApproveAll,
  onPublishCsv,
  onPublishApi,
  onResetZoom,
}: GlobalCatalogToolbarProps) {
  return (
    <div className="starlink-inv-block sat-stats-toolbar">
      <div className="sat-stats-section-head">
        <div>
          <div className="mesh-overlay-label">Global catalog · GCAT</div>
          <p className="starlink-inv-block-desc">
            All launches &amp; satellites — McDowell GCAT launch.tsv + satcat.tsv
          </p>
        </div>
        <span className={`starlink-inv-badge ${busy ? 'starlink-inv-badge--estimate' : 'starlink-inv-badge--live'}`}>
          {busy ? 'working' : 'ready'}
        </span>
      </div>

      <div className="sat-stats-toolbar-actions">
        <button type="button" className="mesh-toggle mesh-toggle-on" disabled={busy} onClick={onUpdate}>
          update global
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onRefresh}>
          refresh
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={busy || bootstrapDone}
          onClick={() => onBootstrap(false)}
          title={bootstrapDone ? `GCAT loaded · ${launchCount.toLocaleString()} launches · ${satelliteCount.toLocaleString()} objects` : undefined}
        >
          {bootstrapDone
            ? `gcat bootstrap ✓ (${launchCount.toLocaleString()} / ${satelliteCount.toLocaleString()})`
            : 'bootstrap gcat'}
        </button>
        {bootstrapDone && (
          <button type="button" className="mesh-toggle" disabled={busy} onClick={() => onBootstrap(true)}>
            force bootstrap
          </button>
        )}
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onApproveAll}>
          approve all
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onPublishCsv}>
          publish csv
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onPublishApi}>
          publish api
        </button>
        <button type="button" className="mesh-toggle" disabled={busy} onClick={onResetZoom}>
          reset zoom
        </button>
      </div>

      <div className="sat-stats-toolbar-actions global-catalog-toggles">
        <div className="mesh-toggles mb-0">
          <button
            type="button"
            className={`mesh-toggle ${viewScope === 'orbital' ? 'mesh-toggle-on' : ''}`}
            disabled={busy}
            onClick={() => onViewScopeChange('orbital')}
          >
            orbital only
          </button>
          <button
            type="button"
            className={`mesh-toggle ${viewScope === 'all' ? 'mesh-toggle-on' : ''}`}
            disabled={busy}
            onClick={() => onViewScopeChange('all')}
          >
            all activity
          </button>
        </div>
        <div className="mesh-toggles mb-0">
          <button
            type="button"
            className={`mesh-toggle ${satKind === 'payloads' ? 'mesh-toggle-on' : ''}`}
            disabled={busy}
            onClick={() => onSatKindChange('payloads')}
          >
            payloads
          </button>
          <button
            type="button"
            className={`mesh-toggle ${satKind === 'non_payloads' ? 'mesh-toggle-on' : ''}`}
            disabled={busy}
            onClick={() => onSatKindChange('non_payloads')}
          >
            debris &amp; other
          </button>
        </div>
      </div>

      <div className="sat-stats-status" title={status}>
        {status}
      </div>
    </div>
  );
}
