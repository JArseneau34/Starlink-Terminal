import { useMemo, useState } from 'react';
import { useGlobalCatalogDashboard } from '../../../hooks/useGlobalCatalogDashboard';
import type { GlobalCatalogSatKind, GlobalCatalogViewScope } from '../../../types/globalCatalog';
import { resolveGlobalDashboard, resolveGlobalFeeds } from '../../../utils/globalCatalogView';
import { GlobalCatalogChartsGrid } from './GlobalCatalogChartsGrid';
import { GlobalCatalogCompositionTable } from './GlobalCatalogCompositionTable';
import { GlobalCatalogKpiStrip } from './GlobalCatalogKpiStrip';
import { GlobalCatalogReviewQueue } from './GlobalCatalogReviewQueue';
import { GlobalCatalogToolbar } from './GlobalCatalogToolbar';

export function GlobalCatalogDashboard({ enabled = true }: { enabled?: boolean }) {
  const dash = useGlobalCatalogDashboard(enabled);
  const [viewScope, setViewScope] = useState<GlobalCatalogViewScope>('orbital');
  const [satKind, setSatKind] = useState<GlobalCatalogSatKind>('payloads');
  const [zoomReset, setZoomReset] = useState(0);

  const { dashboard, objectKinds } = useMemo(
    () => resolveGlobalDashboard(dash.snapshot?.dashboard, viewScope, satKind),
    [dash.snapshot?.dashboard, viewScope, satKind]
  );

  const feeds = useMemo(
    () => resolveGlobalFeeds(dash.snapshot?.feeds, viewScope, satKind),
    [dash.snapshot?.feeds, viewScope, satKind]
  );

  return (
    <div className="starlink-investor-pipeline global-catalog-dashboard">
      <GlobalCatalogToolbar
        status={dash.status}
        busy={dash.busy}
        bootstrapDone={dash.bootstrapDone}
        launchCount={dash.launchCount}
        satelliteCount={dash.satelliteCount}
        viewScope={viewScope}
        satKind={satKind}
        onViewScopeChange={setViewScope}
        onSatKindChange={setSatKind}
        onUpdate={() => void dash.runUpdate()}
        onRefresh={() => void dash.refresh()}
        onBootstrap={(force) => void dash.runBootstrap(force)}
        onApproveAll={() => void dash.approveAll()}
        onPublishCsv={() => void dash.publishCsv()}
        onPublishApi={() => void dash.publishApi()}
        onResetZoom={() => setZoomReset((t) => t + 1)}
      />

      {dash.error && !dash.snapshot && (
        <div className="starlink-inv-block sat-stats-error">
          <div className="mesh-overlay-label">Global catalog unavailable</div>
          <p className="starlink-inv-block-desc">{dash.error}</p>
          <p className="starlink-inv-footnote">
            Requires Space-Industry-Data-Pipeline running at PIPELINE_API_URL (default http://localhost:8000).
            Run bootstrap GCAT once, then Update Global.
          </p>
        </div>
      )}

      <GlobalCatalogKpiStrip
        dashboard={dashboard}
        viewScope={viewScope}
        satKind={satKind}
        snapshotId={dash.snapshot?.snapshot_id}
        isLoading={dash.busy}
      />

      <GlobalCatalogCompositionTable rows={objectKinds} viewScope={viewScope} />

      <GlobalCatalogChartsGrid
        feeds={feeds}
        satKind={satKind}
        snapshotId={dash.snapshot?.snapshot_id}
        resetToken={zoomReset}
      />

      <div className="sat-stats-ops-grid global-catalog-ops">
        <GlobalCatalogReviewQueue
          reviews={dash.reviews}
          busy={dash.busy}
          onApprove={(id) => void dash.approveReview(id)}
          onReject={(id) => void dash.rejectReview(id)}
        />
        <div className="starlink-inv-block global-catalog-info">
          <div className="mesh-overlay-label">GCAT sources</div>
          <p className="starlink-inv-block-desc">
            Jonathan McDowell&apos;s General Catalog — the superset of all catalogued launches and space objects.
          </p>
          <ul className="global-catalog-source-list">
            <li>
              <code>launch.tsv</code> → <code>global_launches</code>
            </li>
            <li>
              <code>satcat.tsv</code> → <code>global_satellites</code>
            </li>
          </ul>
          <p className="starlink-inv-footnote">
            Bootstrap writes directly to layer-1 tables. <code>/global/update</code> diffs fresh GCAT pulls into the
            review queue. Global data is independent of the Starlink Fleet Data pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
