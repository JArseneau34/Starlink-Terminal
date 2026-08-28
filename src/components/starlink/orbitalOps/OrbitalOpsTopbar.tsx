import type { OrbitalOpsView } from '../../../utils/orbitalOpsControls';
import { orbitalOpsSubtitle } from '../../../utils/orbitalOpsControls';
import { Mach33Icon } from '../../brand/Mach33Mark';

interface OrbitalOpsTopbarProps {
  view: OrbitalOpsView;
  showGhostGrid: boolean;
  liveTrackedCount: number | null;
  onShowOps: () => void;
  onShowManifest: () => void;
  onShowCams: () => void;
  onShowFleet: () => void;
  onShowGlobal: () => void;
  onShowStatus: () => void;
  onShowSettings: () => void;
  onShowDeorbit: () => void;
}

export function OrbitalOpsTopbar({
  view,
  showGhostGrid,
  liveTrackedCount,
  onShowOps,
  onShowManifest,
  onShowCams,
  onShowFleet,
  onShowGlobal,
  onShowStatus,
  onShowSettings,
  onShowDeorbit,
}: OrbitalOpsTopbarProps) {
  const opsFamily = view === 'ops' || view === 'deorbit';
  const manifestFamily = view === 'manifest' || view === 'cams';
  const statusFamily = view === 'status' || view === 'settings';

  return (
    <div className="orbital-ops-topbar-stack">
      <div className="orbital-ops-topbar">
        <div className="orbital-ops-brand">
          <Mach33Icon />
          <div className="orbital-ops-brand-copy">
            <div className="orbital-ops-brand-title">Sat Stats</div>
            <div className="text-[9px] text-bbg-muted tracking-wider mt-0.5 orbital-ops-title-sub">
              {orbitalOpsSubtitle(view, showGhostGrid)}
              {view === 'ops' && liveTrackedCount != null && liveTrackedCount > 0 ? (
                <span className="ml-2 tabular-nums">
                  · {liveTrackedCount.toLocaleString()} tracked
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <nav className="subtab-nav orbital-ops-tabs" aria-label="Primary views">
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--ops ${opsFamily ? 'subtab-btn-active' : ''}`}
            onClick={onShowOps}
          >
            Orbital Ops
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--manifest ${manifestFamily ? 'subtab-btn-active starlink-investor-subtab--manifest' : ''}`}
            onClick={onShowManifest}
          >
            Manifest
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--fleet ${view === 'fleet' ? 'subtab-btn-active starlink-investor-subtab--fleet' : ''}`}
            onClick={onShowFleet}
          >
            Fleet Data
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--global ${view === 'global' ? 'subtab-btn-active starlink-investor-subtab--global' : ''}`}
            onClick={onShowGlobal}
          >
            Global Catalog
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--status ${statusFamily ? 'subtab-btn-active' : ''}`}
            onClick={onShowStatus}
          >
            Status/Settings
          </button>
        </nav>
      </div>

      {opsFamily ? (
        <nav className="orbital-ops-subtabs" aria-label="Orbital Ops modes">
          <button
            type="button"
            className={`orbital-ops-subtab${view === 'ops' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowOps}
          >
            Mesh
          </button>
          <button
            type="button"
            className={`orbital-ops-subtab orbital-ops-subtab--deorbit${view === 'deorbit' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowDeorbit}
          >
            Deorbit
          </button>
        </nav>
      ) : null}

      {manifestFamily ? (
        <nav className="orbital-ops-subtabs" aria-label="Manifest modes">
          <button
            type="button"
            className={`orbital-ops-subtab${view === 'manifest' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowManifest}
          >
            Board
          </button>
          <button
            type="button"
            className={`orbital-ops-subtab orbital-ops-subtab--cams${view === 'cams' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowCams}
          >
            Pad feeds
          </button>
        </nav>
      ) : null}

      {statusFamily ? (
        <nav className="orbital-ops-subtabs" aria-label="Status and settings">
          <button
            type="button"
            className={`orbital-ops-subtab${view === 'status' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowStatus}
          >
            Status
          </button>
          <button
            type="button"
            className={`orbital-ops-subtab orbital-ops-subtab--settings${view === 'settings' ? ' orbital-ops-subtab--active' : ''}`}
            onClick={onShowSettings}
          >
            Settings
          </button>
        </nav>
      ) : null}
    </div>
  );
}
