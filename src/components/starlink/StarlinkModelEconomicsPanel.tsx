import { useMemo } from 'react';
import type { StarlinkIntelPayload } from '../../types/orbital';
import { buildModelEconomics } from '../../utils/starlinkModelEconomics';

interface StarlinkModelEconomicsPanelProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function StarlinkModelEconomicsPanel({ intel, isLoading }: StarlinkModelEconomicsPanelProps) {
  const econ = useMemo(() => buildModelEconomics(intel), [intel]);

  if (isLoading && !intel) {
    return (
      <div className="mesh-side-panel">
        <div className="mesh-overlay-label">Model Mix Economics</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading fleet intel…</div>
      </div>
    );
  }

  return (
    <div className="mesh-side-panel starlink-econ">
      <div className="starlink-econ-head">
        <div className="mesh-overlay-label mb-0">Model Mix Economics</div>
        <span className="text-bbg-muted text-[8px] tracking-wide">
          McDowell · {formatSnapshotDate(econ.snapshotDate)}
        </span>
      </div>

      <p className="starlink-econ-lede">
        Each V2 Mini delivers <b className="text-bbg-white">{econ.v2VsV15Multiple.toFixed(0)}×</b> the
        broadband capacity of a V1.5; direct-to-cell is a separate, cellular-backhaul capability.
      </p>

      <div className="starlink-econ-grid">
        {econ.entries.map((e) => (
          <div key={e.key} className="starlink-econ-card" style={{ '--econ-accent': e.accent } as React.CSSProperties}>
            <div className="starlink-econ-card-label">{e.label}</div>
            <div className="starlink-econ-card-cap">{e.capability}</div>

            <div className="starlink-econ-metric">
              <div className="starlink-econ-metric-value tabular-nums">
                {e.gbpsPerSat == null ? '—' : e.gbpsPerSat}
                {e.gbpsPerSat != null && <span className="starlink-econ-unit">Gbps</span>}
              </div>
              <div className="starlink-econ-metric-label">
                {e.gbpsPerSat == null ? 'no broadband' : 'per satellite'}
              </div>
            </div>

            <div className="starlink-econ-row">
              <span>vs V1.5</span>
              <b className="tabular-nums">{e.multipleVsV15 == null ? 'n/a' : `${e.multipleVsV15.toFixed(0)}×`}</b>
            </div>
            <div className="starlink-econ-row">
              <span>in orbit</span>
              <b className="tabular-nums">{e.count.toLocaleString()}</b>
            </div>
            <div className="starlink-econ-row">
              <span>fleet cap.</span>
              <b className="tabular-nums">
                {e.key === 'dtc' ? 'cellular' : `${e.fleetTbps.toFixed(1)} Tbps`}
              </b>
            </div>

            <div className="starlink-econ-share-track" title={`${(e.capacityShare * 100).toFixed(1)}% of constellation broadband`}>
              <div
                className="starlink-econ-share-fill"
                style={{ width: `${Math.max(2, e.capacityShare * 100)}%`, background: e.accent }}
              />
            </div>
            <div className="starlink-econ-share-label tabular-nums">
              {e.key === 'dtc' ? 'D2C revenue stream' : `${(e.capacityShare * 100).toFixed(0)}% of capacity`}
            </div>
          </div>
        ))}
      </div>

      <div className="starlink-econ-foot">
        <span>constellation broadband</span>
        <b className="text-bbg-cyan tabular-nums">{econ.totalBroadbandTbps.toFixed(1)} Tbps</b>
      </div>
    </div>
  );
}
