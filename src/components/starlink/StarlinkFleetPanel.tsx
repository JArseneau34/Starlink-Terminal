import type { StarlinkCatalogPayload, StarlinkIntelPayload, StarlinkMeshMode } from '../../types/orbital';
import { shellHex } from './starlinkCatalog';
import { VISUAL_SHELL_SPECS } from '../../data/starlinkVisualShells';
import { StarlinkFleetGrowthChart } from './StarlinkFleetGrowthChart';
import { StarlinkLaunchProductivityChart } from './StarlinkLaunchProductivityChart';

interface StarlinkFleetPanelProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
  /** Live TLE catalog — drives counts/shells when meshMode is live. */
  liveCatalog?: StarlinkCatalogPayload | null;
  meshMode?: StarlinkMeshMode;
}

function lifecyclePct(intel: StarlinkIntelPayload, key: keyof StarlinkIntelPayload['lifecycle']): number {
  const total = intel.totalTracked || 1;
  return (intel.lifecycle[key] / total) * 100;
}

function formatAgeHours(hours: number): string {
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Relative freshness of the live TLE feed — genuine live-pipeline signal from the payload. */
function formatFeedAge(iso: string): { text: string; fresh: boolean } {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { text: 'live', fresh: true };
  const min = Math.round(ms / 60000);
  if (min < 1) return { text: 'just now', fresh: true };
  if (min < 60) return { text: `${min}m ago`, fresh: min < 30 };
  const hr = Math.round(min / 60);
  if (hr < 24) return { text: `${hr}h ago`, fresh: false };
  return { text: `${Math.round(hr / 24)}d ago`, fresh: false };
}

const MODELS: {
  key: keyof StarlinkIntelPayload['authoritative']['models'];
  label: string;
  color: string;
  desc: string;
}[] = [
  { key: 'v1', label: 'V1.0', color: '#7a7a90', desc: 'Gen-1 (legacy)' },
  { key: 'v15', label: 'V1.5', color: '#3de8ff', desc: 'Gen-1.5 laser-link' },
  { key: 'v2Mini', label: 'V2 Mini', color: '#a78bfa', desc: 'Gen-2 Mini' },
  { key: 'v2MiniD2c', label: 'V2 Mini DTC', color: '#2ee86a', desc: 'Direct-to-Cell' },
  { key: 'v2MiniOpt', label: 'V2 Mini Opt', color: '#ff6bd6', desc: 'Optimized Gen-2 Mini' },
];

const MCDOWELL_TITLE =
  "Jonathan McDowell's authoritative catalog: satellites SpaceX reports as operationally working.";
const NORAD_TITLE =
  'Objects with a current NORAD/CelesTrak TLE (includes raising, decaying and non-working hardware).';

export function StarlinkFleetPanel({
  intel,
  isLoading,
  liveCatalog = null,
  meshMode = 'topology',
}: StarlinkFleetPanelProps) {
  if (isLoading && !intel) {
    return (
      <div className="mesh-side-panel">
        <div className="mesh-overlay-label">Starlink Fleet · NORAD + McDowell</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading fleet intel…</div>
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="mesh-side-panel">
        <div className="mesh-overlay-label">Starlink Fleet · NORAD + McDowell</div>
        <div className="text-bbg-muted text-[10px] py-2">Fleet intel unavailable</div>
      </div>
    );
  }

  const { lifecycle, authoritative } = intel;
  const raising = lifecycle.raising + lifecycle.deorbiting;
  const { reconciliation } = authoritative;
  const liveTle = intel.liveTleAvailable !== false;
  const feed = formatFeedAge(intel.tleFetchedAt);
  const modelTotal = MODELS.reduce((sum, m) => sum + authoritative.models[m.key], 0) || 1;
  const deltaClass =
    reconciliation.delta === 0 ? 'text-bbg-gray' : reconciliation.delta > 0 ? 'text-bbg-amber' : 'text-bbg-cyan';

  const isLiveView = meshMode === 'live' && liveCatalog != null && liveCatalog.count > 0;
  const factualCount = isLiveView ? liveCatalog.count : authoritative.totalWorking;
  const intelShellByName = new Map(intel.shells.map((sh) => [sh.name, sh]));

  return (
    <div className="mesh-side-panel starlink-fleet-panel">
      <div className="starlink-fleet-head">
        <div className="mesh-overlay-label mb-0">Starlink Fleet</div>
        <span
          className={`starlink-fleet-pill ${liveTle && feed.fresh ? 'starlink-fleet-pill--live' : 'starlink-fleet-pill--stale'}`}
          title={
            liveTle
              ? `Live pipeline · NORAD TLE feed refreshed ${feed.text}`
              : 'Live CelesTrak NORAD feed unavailable — showing McDowell / pipeline snapshot.'
          }
        >
          <i className="starlink-fleet-pill-dot" />
          {liveTle ? `live · ${feed.text}` : 'snapshot'}
        </span>
      </div>

      <div
        className="starlink-fleet-headline"
        title={isLiveView ? NORAD_TITLE : MCDOWELL_TITLE}
      >
        <div className="starlink-fleet-headline-num tabular-nums">
          {factualCount.toLocaleString()}
        </div>
        <div className="starlink-fleet-headline-label">
          {isLiveView ? 'satellites tracked' : 'working satellites'}
          <span className="starlink-fleet-headline-src">
            {isLiveView
              ? `live TLE · ${liveCatalog.tleSource} · SGP4 positions`
              : `McDowell · ${formatSnapshotDate(authoritative.snapshotDate)}`}
          </span>
        </div>
      </div>

      {isLiveView && (
        <div className="starlink-fleet-recon mb-2">
          <div className="mesh-stat-row" title={MCDOWELL_TITLE}>
            <span>McDowell working</span>
            <b className="text-bbg-muted">{authoritative.totalWorking.toLocaleString()}</b>
          </div>
          <div
            className="mesh-stat-row"
            title="Live NORAD TLE count minus McDowell working — raising, decaying, catalog lag, or incomplete feed."
          >
            <span>vs snapshot</span>
            <b className={deltaClass}>{formatDelta(factualCount - authoritative.totalWorking)}</b>
          </div>
        </div>
      )}

      <div className="starlink-fleet-cards mb-2">
        <div className="starlink-fleet-card" title="Aggregate downlink capacity of the working fleet (McDowell snapshot).">
          <div className="starlink-fleet-card-value text-bbg-cyan tabular-nums">
            {authoritative.bandwidthTbps.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
          <div className="starlink-fleet-card-label">Tbps in orbit</div>
        </div>
        <div className="starlink-fleet-card" title="Decommissioned / deorbited spacecraft in the McDowell snapshot.">
          <div className="starlink-fleet-card-value text-bbg-gray tabular-nums">
            {authoritative.totalDown.toLocaleString()}
          </div>
          <div className="starlink-fleet-card-label">deorbited</div>
        </div>
      </div>

      <div className="mesh-overlay-label">Fleet Growth · McDowell + capacity model</div>
      <div className="starlink-fleet-growth mb-3">
        <StarlinkFleetGrowthChart />
      </div>

      <div className="mesh-overlay-label">Launch Productivity · per launch by quarter</div>
      <div className="starlink-fleet-growth mb-3">
        <StarlinkLaunchProductivityChart />
      </div>

      <div className="starlink-fleet-recon mb-3">
        <div className="mesh-stat-row" title={NORAD_TITLE}>
          <span>NORAD tracked</span>
          <b className={liveTle ? 'text-bbg-white' : 'text-bbg-muted'}>
            {liveTle ? intel.totalTracked.toLocaleString() : 'offline'}
          </b>
        </div>
        <div className="mesh-stat-row" title="NORAD-tracked minus McDowell working — raising, decaying or non-working objects.">
          <span>reconciliation Δ</span>
          <b className={deltaClass}>{formatDelta(reconciliation.delta)}</b>
        </div>
        <div className="starlink-fleet-recon-note" title={reconciliation.note}>
          {reconciliation.note}
        </div>
      </div>

      <div className="mesh-overlay-label">Model Mix · McDowell</div>
      <div className="starlink-fleet-model-bar mb-2" title="Working fleet by hardware generation">
        {MODELS.map((m) => {
          const count = authoritative.models[m.key];
          if (count <= 0) return null;
          return (
            <div
              key={m.key}
              className="starlink-fleet-model-seg"
              style={{ width: `${(count / modelTotal) * 100}%`, background: m.color }}
              title={`${m.label} · ${count.toLocaleString()} (${((count / modelTotal) * 100).toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="starlink-fleet-models mb-3">
        {MODELS.map((m) => {
          const count = authoritative.models[m.key];
          const pct = (count / modelTotal) * 100;
          return (
            <div key={m.key} className="starlink-fleet-model-row" title={m.desc}>
              <span className="starlink-fleet-model-dot" style={{ background: m.color }} />
              <span className="starlink-fleet-model-name">{m.label}</span>
              <span className="starlink-fleet-model-count tabular-nums">{count.toLocaleString()}</span>
              <span className="starlink-fleet-model-pct tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      <div className="mesh-overlay-label">NORAD / SpaceX Feed</div>
      {intel.ephemerisPublished > 0 && (
        <div className="mesh-stat-row">
          <span>SpaceX ephemerides</span>
          <b className="text-bbg-cyan">{intel.ephemerisPublished.toLocaleString()}</b>
        </div>
      )}
      {liveTle ? (
        <>
          <div className="mesh-stat-row">
            <span>launched YTD</span>
            <b className="text-bbg-amber">{intel.launchedYtd.toLocaleString()}</b>
          </div>
          <div className="mesh-stat-row mb-2">
            <span>TLE median age</span>
            <b>{formatAgeHours(intel.medianEpochAgeHours)}</b>
          </div>
        </>
      ) : (
        <div className="starlink-fleet-recon-note mb-2">
          Live NORAD/TLE telemetry offline — lifecycle, shell and launch breakdowns resume when the
          CelesTrak feed is reachable.
        </div>
      )}

      {liveTle && (
        <>
          <div className="starlink-lifecycle-bar mb-2" title="Operational / raising / deorbiting / other (NORAD-tracked)">
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

          <div className="mesh-overlay-label">
            {isLiveView ? 'Mission Shells · live catalog' : 'Shell Distribution'}
          </div>
          {(isLiveView ? liveCatalog.shells : intel.shells).map((sh) => {
            const shellDef = VISUAL_SHELL_SPECS.find((s) => s.name === sh.name);
            const hex = shellDef ? shellHex(shellDef.color) : '#3de8ff';
            const intelSh = intelShellByName.get(sh.name);
            const raisingCount = intelSh?.raising ?? 0;
            return (
              <div key={sh.name} className="mesh-legend-row">
                <span className="mesh-legend-dot" style={{ color: hex, background: hex }} />
                <span>{sh.name}</span>
                <span className="mesh-legend-count">
                  {sh.count.toLocaleString()}
                  {raisingCount > 0 && (
                    <span className="text-bbg-amber ml-1">+{raisingCount}↑</span>
                  )}
                </span>
              </div>
            );
          })}
        </>
      )}

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
