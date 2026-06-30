import { useMemo } from 'react';
import type { StarlinkIntelPayload } from '../../types/orbital';
import { buildDirectToCellTracker } from '../../utils/starlinkDirectToCellTracker';

interface StarlinkDirectToCellTrackerProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function StarlinkDirectToCellTracker({ intel, isLoading }: StarlinkDirectToCellTrackerProps) {
  const dtc = useMemo(() => buildDirectToCellTracker(intel), [intel]);

  if (isLoading && !intel) {
    return (
      <div className="starlink-dtc">
        <div className="mesh-overlay-label">Direct-To-Cell Tracker</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading DTC snapshot…</div>
      </div>
    );
  }

  return (
    <div className="starlink-dtc">
      <div className="starlink-dtc-head">
        <div className="mesh-overlay-label mb-0">Direct-To-Cell Tracker</div>
        <span className="starlink-dtc-pill">revenue expansion</span>
      </div>

      <div className="starlink-dtc-hero">
        <div>
          <div className="starlink-dtc-hero-value tabular-nums">
            {dtc.dtcSatellites.toLocaleString()}
          </div>
          <div className="starlink-dtc-hero-label">
            DTC satellites in working fleet · {formatSnapshotDate(dtc.snapshotDate)}
          </div>
        </div>
        <div className="starlink-dtc-orbit">
          <span />
          <i />
        </div>
      </div>

      <div className="starlink-dtc-metrics">
        <div className="starlink-dtc-metric">
          <span>fleet share</span>
          <b className="tabular-nums">{pct(dtc.fleetShare)}</b>
          <div className="starlink-dtc-track">
            <i style={{ width: `${Math.max(2, dtc.fleetShare * 100)}%` }} />
          </div>
        </div>
        <div className="starlink-dtc-metric">
          <span>Gen-2 mix</span>
          <b className="tabular-nums">{pct(dtc.gen2Share)}</b>
          <div className="starlink-dtc-track">
            <i style={{ width: `${Math.max(2, dtc.gen2Share * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="starlink-dtc-stage">
        <div>
          <span>service layer</span>
          <b>cellular wholesale / carrier adjacency</b>
        </div>
        <div>
          <span>broadband capacity</span>
          <b className="tabular-nums">{dtc.broadbandTbpsDisplaced.toFixed(1)} Tbps</b>
        </div>
        <div>
          <span>curated launch signal</span>
          <b>
            {dtc.curatedDtcLaunches > 0
              ? `${dtc.curatedDtcLaunches} batch · ${dtc.curatedDtcPayloadSats} sats`
              : 'not flagged'}
          </b>
        </div>
      </div>

      <p className="starlink-dtc-note">
        DTC is tracked separately from broadband throughput because its value comes from carrier
        coverage expansion, roaming replacement, and phone-to-satellite service optionality.
        {dtc.mostRecentCuratedSignal ? (
          <>
            {' '}
            The mesh also flags <span>{dtc.mostRecentCuratedSignal}</span> as DTC-capable.
          </>
        ) : null}
      </p>
    </div>
  );
}
