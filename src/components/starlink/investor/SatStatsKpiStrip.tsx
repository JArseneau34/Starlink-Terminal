import type { SatStatsDashboard } from '../../../types/satStats';
import { fmtMetric } from './satStatsChartTheme';

const KPI_ITEMS = [
  { key: 'launches', label: 'Total Launches', field: 'total_launches_all_time' as const },
  { key: 'active', label: 'Active Satellites', field: 'active_satellites' as const },
  { key: 'customers', label: 'Est. Customers', field: 'est_customers' as const },
  { key: 'bw', label: 'Constellation BW', field: 'constellation_bw_tbps' as const, suffix: ' Tbps' },
  { key: 'deorbited', label: 'Deorbited', field: 'deorbited_satellites' as const },
];

interface SatStatsKpiStripProps {
  dashboard: SatStatsDashboard | null;
  snapshotId?: number;
  isLoading?: boolean;
}

export function SatStatsKpiStrip({ dashboard, snapshotId, isLoading }: SatStatsKpiStripProps) {
  return (
    <div className="starlink-inv-block starlink-inv-block--kpis sat-stats-kpi-strip">
      <div className="sat-stats-section-head">
        <div>
          <div className="mesh-overlay-label">Fleet & launch KPIs</div>
          <p className="starlink-inv-block-desc">
            Computed from approved layer-1 data · McDowell fleet + launch archive
          </p>
        </div>
        {snapshotId != null && (
          <span className="starlink-inv-badge starlink-inv-badge--live">snap #{snapshotId}</span>
        )}
      </div>
      <div className="starlink-inv-kpi-row">
        {KPI_ITEMS.map((item) => (
          <div key={item.key} className="starlink-inv-kpi">
            <div className="starlink-inv-kpi-label">{item.label}</div>
            <div className="starlink-inv-kpi-value">
              {isLoading && !dashboard
                ? '…'
                : `${fmtMetric(dashboard?.[item.field])}${item.suffix ?? ''}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
