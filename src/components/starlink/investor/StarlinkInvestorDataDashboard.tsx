import { useState } from 'react';
import { useSatStatsDashboard } from '../../../hooks/useSatStatsDashboard';
import { SatStatsChartsGrid } from './SatStatsChartsGrid';
import { SatStatsKpiStrip } from './SatStatsKpiStrip';
import { SatStatsModelAssumptions } from './SatStatsModelAssumptions';
import { SatStatsReviewQueue } from './SatStatsReviewQueue';
import { SatStatsToolbar } from './SatStatsToolbar';

export function StarlinkInvestorDataDashboard({ enabled = true }: { enabled?: boolean }) {
  const dash = useSatStatsDashboard(enabled);
  const [zoomReset, setZoomReset] = useState(0);

  return (
    <div className="starlink-investor-pipeline fleet-data-dashboard">
      <SatStatsToolbar
        status={dash.status}
        busy={dash.busy}
        bootstrapDone={dash.bootstrapDone}
        launchCount={dash.launchCount}
        snapshotId={dash.snapshot?.snapshot_id ?? null}
        onUpdate={() => void dash.runUpdate()}
        onRefresh={() => void dash.refresh()}
        onBootstrap={(force) => void dash.runBootstrap(force)}
        onApproveAll={() => void dash.approveAll()}
        onTrueUp={() => void dash.runTrueUp()}
        onPublishCsv={() => void dash.publishCsv()}
        onPublish={() => void dash.publishApi()}
        onResetZoom={() => setZoomReset((t) => t + 1)}
      />

      {dash.error && !dash.snapshot && (
        <div className="starlink-inv-block sat-stats-error">
          <div className="mesh-overlay-label">Pipeline unavailable</div>
          <p className="starlink-inv-block-desc">{dash.error}</p>
        </div>
      )}

      <SatStatsKpiStrip
        dashboard={dash.snapshot?.dashboard ?? null}
        snapshotId={dash.snapshot?.snapshot_id}
        isLoading={dash.busy}
      />

      <SatStatsChartsGrid snapshot={dash.snapshot} resetToken={zoomReset} />

      <div className="sat-stats-ops-grid">
        <SatStatsReviewQueue
          reviews={dash.reviews}
          busy={dash.busy}
          onApprove={(id) => void dash.approveReview(id)}
          onReject={(id) => void dash.rejectReview(id)}
        />
        <SatStatsModelAssumptions
          models={dash.models}
          busy={dash.busy}
          onSave={(model) => void dash.saveModel(model)}
        />
      </div>
    </div>
  );
}
