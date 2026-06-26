import type { StarlinkIntelPayload } from '../../types/orbital';
import { STARLINK_SHELLS, shellHex } from './starlinkCatalog';

interface StarlinkFleetPanelProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

function lifecyclePct(intel: StarlinkIntelPayload, key: keyof StarlinkIntelPayload['lifecycle']): number {
  const total = intel.totalTracked || 1;
  return (intel.lifecycle[key] / total) * 100;
}

function formatAgeHours(hours: number): string {
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function StarlinkFleetPanel({ intel, isLoading }: StarlinkFleetPanelProps) {
  if (isLoading && !intel) {
    return (
      <div className="mesh-side-panel">
        <div className="mesh-overlay-label">Starlink Fleet · NORAD + SpaceX</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading fleet intel…</div>
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="mesh-side-panel">
        <div className="mesh-overlay-label">Starlink Fleet · NORAD + SpaceX</div>
        <div className="text-bbg-muted text-[10px] py-2">Fleet intel unavailable</div>
      </div>
    );
  }

  const { lifecycle } = intel;
  const raising = lifecycle.raising + lifecycle.deorbiting;

  return (
    <div className="mesh-side-panel starlink-fleet-panel">
      <div className="mesh-overlay-label">Starlink Fleet · NORAD + SpaceX</div>
      <div className="text-[9px] text-bbg-muted tracking-wider mb-2 leading-snug">
        CelesTrak TLE · SpaceX manifest
      </div>

      <div className="mesh-stat-row">
        <span>NORAD tracked</span>
        <b>{intel.totalTracked.toLocaleString()}</b>
      </div>
      <div className="mesh-stat-row">
        <span>SpaceX ephemerides</span>
        <b className="text-bbg-cyan">{intel.ephemerisPublished.toLocaleString()}</b>
      </div>
      <div className="mesh-stat-row">
        <span>launched YTD</span>
        <b className="text-bbg-amber">{intel.launchedYtd.toLocaleString()}</b>
      </div>
      <div className="mesh-stat-row mb-2">
        <span>TLE median age</span>
        <b>{formatAgeHours(intel.medianEpochAgeHours)}</b>
      </div>

      <div className="starlink-lifecycle-bar mb-2" title="Operational / raising / deorbiting / other">
        <div
          className="starlink-lifecycle-seg starlink-lifecycle-seg--operational"
          style={{ width: `${lifecyclePct(intel, 'operational')}%` }}
        />
        <div
          className="starlink-lifecycle-seg starlink-lifecycle-seg--raising"
          style={{ width: `${lifecyclePct(intel, 'raising')}%` }}
        />
        <div
          className="starlink-lifecycle-seg starlink-lifecycle-seg--deorbiting"
          style={{ width: `${lifecyclePct(intel, 'deorbiting')}%` }}
        />
        <div
          className="starlink-lifecycle-seg starlink-lifecycle-seg--other"
          style={{ width: `${lifecyclePct(intel, 'other')}%` }}
        />
      </div>
      <div className="starlink-lifecycle-legend mb-3">
        <span>
          <i className="starlink-lifecycle-dot starlink-lifecycle-dot--operational" />
          {lifecycle.operational.toLocaleString()} ops
        </span>
        <span>
          <i className="starlink-lifecycle-dot starlink-lifecycle-dot--raising" />
          {raising.toLocaleString()} raise/decay
        </span>
      </div>

      <div className="mesh-overlay-label">Shell Distribution</div>
      {intel.shells.map((sh) => {
        const shellDef = STARLINK_SHELLS.find((s) => s.name === sh.name);
        const hex = shellDef ? shellHex(shellDef.color) : '#3de8ff';
        return (
          <div key={sh.name} className="mesh-legend-row">
            <span className="mesh-legend-dot" style={{ color: hex, background: hex }} />
            <span>{sh.name} incl.</span>
            <span className="mesh-legend-count">
              {sh.count.toLocaleString()}
              {sh.raising > 0 && (
                <span className="text-bbg-amber ml-1">+{sh.raising}↑</span>
              )}
            </span>
          </div>
        );
      })}

      {intel.recentLaunches.length > 0 && (
        <div className="mt-3">
          <div className="mesh-overlay-label">Recent Launch Batches</div>
          <ul className="space-y-1 mt-1 max-h-36 overflow-y-auto">
            {intel.recentLaunches.map((launch) => (
              <li key={launch.intlDesignator} className="flex justify-between gap-2 text-[10px] min-w-0">
                <span className="text-bbg-white tabular-nums shrink-0">{launch.intlDesignator}</span>
                <span className="text-bbg-muted tabular-nums truncate text-right">
                  {launch.satelliteCount} sats · {launch.dominantShell}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
