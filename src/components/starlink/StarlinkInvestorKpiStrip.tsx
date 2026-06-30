import { useMemo } from 'react';
import type { StarlinkIntelPayload } from '../../types/orbital';
import { buildInvestorKpiSnapshot } from '../../utils/starlinkInvestorKpis';

interface StarlinkInvestorKpiStripProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

export function StarlinkInvestorKpiStrip({ intel, isLoading }: StarlinkInvestorKpiStripProps) {
  const snapshot = useMemo(() => buildInvestorKpiSnapshot(intel), [intel]);

  return (
    <div className="mesh-overlay orbital-ops-kpi-strip starlink-inv-block starlink-inv-block--kpis">
      <div className="starlink-inv-kpi-row">
        {snapshot.items.map((kpi) => (
          <div key={kpi.key} className="starlink-inv-kpi" title={kpi.title}>
            <div className="starlink-inv-kpi-head">
              <div className="starlink-inv-kpi-label">{kpi.label}</div>
              <span className={`starlink-inv-badge starlink-inv-badge--${kpi.badge}`}>
                {kpi.badgeLabel}
              </span>
            </div>
            <div className="starlink-inv-kpi-value">
              {isLoading && !intel && kpi.key === 'active-sats' ? '…' : kpi.value}
            </div>
            <div className="starlink-inv-kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
