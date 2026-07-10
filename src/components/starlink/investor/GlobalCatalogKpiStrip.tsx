import type { GlobalCatalogDashboard, GlobalCatalogSatKind, GlobalCatalogViewScope } from '../../../types/globalCatalog';
import { fmtMetric } from './satStatsChartTheme';

interface GlobalCatalogKpiStripProps {
  dashboard: GlobalCatalogDashboard | null;
  viewScope: GlobalCatalogViewScope;
  satKind: GlobalCatalogSatKind;
  snapshotId?: number;
  isLoading?: boolean;
}

export function GlobalCatalogKpiStrip({
  dashboard,
  viewScope,
  satKind,
  snapshotId,
  isLoading,
}: GlobalCatalogKpiStripProps) {
  const isOrbital = viewScope === 'orbital';
  const noun = satKind === 'payloads' ? 'Satellites' : 'Objects';
  const launchesLabel = isOrbital ? 'Orbital Launches' : 'Total Launches';
  const satsLabel = `${isOrbital ? 'Orbital' : 'Catalogued'} ${noun}`;
  const activeLabel = `Active ${noun}`;

  const launchValue = isOrbital
    ? dashboard?.orbital_launches
    : dashboard?.total_launches_all_time;

  return (
    <div className="starlink-inv-block sat-stats-kpi-strip">
      <div className="sat-stats-section-head">
        <div>
          <div className="mesh-overlay-label">Fleet &amp; launch KPIs</div>
          <p className="starlink-inv-block-desc">
            GCAT-derived metrics{snapshotId != null ? ` · snapshot #${snapshotId}` : ''}
          </p>
        </div>
      </div>
      <div className="starlink-inv-kpi-row">
        <div className="starlink-inv-kpi">
          <span className="starlink-inv-kpi-label">{launchesLabel}</span>
          <b className="starlink-inv-kpi-value">{isLoading ? '…' : fmtMetric(launchValue)}</b>
        </div>
        <div className="starlink-inv-kpi">
          <span className="starlink-inv-kpi-label">Orbital Success Rate</span>
          <b className="starlink-inv-kpi-value">
            {isLoading ? '…' : dashboard?.success_rate_pct != null ? `${fmtMetric(dashboard.success_rate_pct)}%` : '—'}
          </b>
        </div>
        <div className="starlink-inv-kpi">
          <span className="starlink-inv-kpi-label">{satsLabel}</span>
          <b className="starlink-inv-kpi-value">{isLoading ? '…' : fmtMetric(dashboard?.total_satellites_catalogued)}</b>
        </div>
        <div className="starlink-inv-kpi">
          <span className="starlink-inv-kpi-label">{activeLabel}</span>
          <b className="starlink-inv-kpi-value">{isLoading ? '…' : fmtMetric(dashboard?.active_satellites)}</b>
        </div>
        <div className="starlink-inv-kpi">
          <span className="starlink-inv-kpi-label">Unique Operators</span>
          <b className="starlink-inv-kpi-value">{isLoading ? '…' : fmtMetric(dashboard?.unique_operators)}</b>
        </div>
      </div>
    </div>
  );
}
