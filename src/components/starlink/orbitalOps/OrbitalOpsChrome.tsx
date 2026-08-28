import type { ReactNode } from 'react';
import type { WalkerShellCountRow } from '../../../utils/walkerFitView';
import type { StarlinkLaunchOption } from '../../../data/starlinkDeployments';
import { deploymentForNoradId } from '../../../data/starlinkDeployments';
import type { OrbitalDisplayEpochState } from '../../../utils/orbitalDisplayEpoch';
import type { FleetTierKpis } from '../../../utils/fleetTierKpis';
import type { StarlinkCatalogPayload } from '../../../types/orbital';
import type { EarthVisualOptions } from '../earthGlobe';
import { FleetTierKpiCards } from '../FleetTierKpiCards';
import { StarlinkShellFilter } from '../StarlinkShellFilter';
import { StarlinkSatellitePanel } from '../StarlinkSatellitePanel';
import { ConjunctionPanel } from './ConjunctionPanel';
import type { StarlinkHoverInfo, StarlinkTopologyDebugInfo } from '../StarlinkMeshCanvas';
import { altExagLabel } from '../starlinkCatalog';
import type { SocratesSnapshot } from '../../../api/conjunctionsClient';
import { formatDistanceKm } from '../../../utils/displayPrefs';
import { useUserSettings } from '../../../hooks/useUserSettings';
import type { TleEpochPlaybackState } from '../../../hooks/useTleEpochPlayback';
import { TleEpochPlaybackScrubber } from './TleEpochPlaybackScrubber';
import { tleStripBadge, viewMenuSummary, type TleStripBadge, type TleStripTone } from '../../../utils/orbitalOpsControls';
import { launchHighlightHonesty } from '../../../utils/launchHighlightHonesty';

export interface OrbitalOpsChromeProps {
  showGhostGrid: boolean;
  setShowGhostGrid: (fn: (v: boolean) => boolean) => void;
  showPlaneArcs: boolean;
  setShowPlaneArcs: (fn: (v: boolean) => boolean) => void;
  showCoverageCone: boolean;
  setShowCoverageCone: (fn: (v: boolean) => boolean) => void;
  autoSpin: boolean;
  setAutoSpin: (fn: (v: boolean) => boolean) => void;
  bumpResetView: () => void;
  walkerLatticeNodes: number;
  walkerSlotTotal: number;
  mcdowellSnapshotDate: string;
  fleetTierKpis: FleetTierKpis;
  kpisLoading: boolean;
  deploymentKey: string | null;
  setDeploymentKey: (key: string | null) => void;
  launchOptions: StarlinkLaunchOption[];
  activeDeployment: StarlinkLaunchOption | null;
  activeHighlightCount: number;
  /** Manifest “Show on mesh” highlight (COSPAR/NORAD join). */
  manifestLaunchHighlight?: {
    entityKey: string;
    label: string;
    matchedVia: string;
    count: number;
    launchTag: string | null;
    failed?: boolean;
    catalogReady?: boolean;
  } | null;
  onClearManifestLaunchHighlight?: () => void;
  speedSlider: number;
  setSpeedSlider: (n: number) => void;
  sizeSlider: number;
  setSizeSlider: (n: number) => void;
  altSlider: number;
  setAltSlider: (n: number) => void;
  speedLabel: string;
  nodeScale: number;
  altExag: number;
  visibleShells: ReadonlySet<number>;
  shellSlotCount: number;
  toggleShell: (shellIndex: number) => void;
  toggleAllShells: () => void;
  shellCounts: WalkerShellCountRow[];
  nodeCount: number;
  liveAvailable: boolean;
  earthVisual: EarthVisualOptions;
  toggleEarthVisual: (key: keyof EarthVisualOptions) => void;
  topologyDebug: StarlinkTopologyDebugInfo | null;
  linkCount: number;
  modeledLiveDelta: number | null;
  shellDeltaByGen: { gen1: number; gen2: number };
  transitCount: number | null;
  liveLoading: boolean;
  liveError: boolean;
  liveCatalogUnavailable: boolean;
  liveCatalog: StarlinkCatalogPayload | null;
  /** NORAD share-link miss — banner, never a fake mesh point. */
  noradUnknown?: string | number | null;
  selectedNoradId: number | null;
  setSelectedNoradId: (id: number | null) => void;
  tleSourceLabel: string;
  catalogStale: boolean;
  catalogFreshnessLabel: string | null;
  /** False when COOP/COEP missing — SGP4 falls back to main thread. */
  workerIsolated?: boolean;
  liveTotal: number;
  displayEpoch: OrbitalDisplayEpochState;
  hover: StarlinkHoverInfo | null;
  selectedLaunchPad?: {
    padKey: string;
    primaryLaunchKey: string;
    name: string;
    pad: string | null;
  } | null;
  onOpenManifestPad?: (primaryLaunchKey: string) => void;
  conjunctions?: SocratesSnapshot | null;
  conjunctionsLoading?: boolean;
  conjunctionsError?: string | null;
  showConjunctions?: boolean;
  setShowConjunctions?: (fn: (v: boolean) => boolean) => void;
  selectedConjunctionId?: string | null;
  setSelectedConjunctionId?: (id: string | null) => void;
  onRefreshConjunctions?: () => void;
  epochPlayback?: TleEpochPlaybackState;
}

function EarthVisualToggles({
  earthVisual,
  toggleEarthVisual,
}: {
  earthVisual: EarthVisualOptions;
  toggleEarthVisual: (key: keyof EarthVisualOptions) => void;
}) {
  return (
    <div className="mesh-toggles mesh-toggles--wrap mesh-earth-toggles mb-0">
      {(
        [
          ['dayMap', 'day map', 'Blue marble day texture'],
          ['nightLights', 'night lights', 'City lights on the night side'],
          ['terminator', 'terminator', 'Sun-aligned day/night boundary'],
          ['atmosphere', 'atmosphere', 'GEV-style sky limb (desaturated, not cyan)'],
          ['graticule', 'graticule', undefined],
        ] as const
      ).map(([key, label, title]) => (
        <button
          key={key}
          type="button"
          className={`mesh-toggle ${earthVisual[key] ? 'mesh-toggle-on' : ''}`}
          onClick={() => toggleEarthVisual(key)}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewToggles({
  autoSpin,
  setAutoSpin,
  bumpResetView,
  showGhostGrid,
  setShowGhostGrid,
  showPlaneArcs,
  setShowPlaneArcs,
  showCoverageCone,
  setShowCoverageCone,
}: Pick<
  OrbitalOpsChromeProps,
  | 'autoSpin'
  | 'setAutoSpin'
  | 'bumpResetView'
  | 'showGhostGrid'
  | 'setShowGhostGrid'
  | 'showPlaneArcs'
  | 'setShowPlaneArcs'
  | 'showCoverageCone'
  | 'setShowCoverageCone'
>) {
  return (
    <div className="orbital-ops-view-menu-list" role="group" aria-label="View overlays">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={autoSpin}
        className={`orbital-ops-view-menu-item${autoSpin ? ' is-on' : ''}`}
        onClick={() => setAutoSpin((v) => !v)}
      >
        auto-spin
      </button>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={showGhostGrid}
        className={`orbital-ops-view-menu-item${showGhostGrid ? ' is-on' : ''}`}
        onClick={() => setShowGhostGrid((v) => !v)}
        title="Walker reference lattice + ISL edges (LOD when zoomed out)"
      >
        ghost grid
      </button>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={showPlaneArcs}
        className={`orbital-ops-view-menu-item${showPlaneArcs ? ' is-on' : ''}`}
        onClick={() => setShowPlaneArcs((v) => !v)}
        title="Faint great-circle arcs for each Walker orbital plane"
      >
        plane arcs
      </button>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={showCoverageCone}
        className={`orbital-ops-view-menu-item${showCoverageCone ? ' is-on' : ''}`}
        onClick={() => setShowCoverageCone((v) => !v)}
        title="User-coverage footprint cone for the selected satellite"
      >
        coverage
      </button>
      <button
        type="button"
        className="orbital-ops-view-menu-item orbital-ops-view-menu-item--action"
        onClick={bumpResetView}
      >
        reset view
      </button>
    </div>
  );
}

function DockFold({
  summary,
  hint,
  children,
}: {
  summary: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <details className="orbital-ops-dock-fold">
      <summary className="orbital-ops-dock-fold-summary" title={hint || summary}>
        <span className="orbital-ops-dock-fold-title">{summary}</span>
        {hint ? <span className="orbital-ops-dock-fold-hint">{hint}</span> : null}
      </summary>
      <div className="orbital-ops-dock-fold-body">{children}</div>
    </details>
  );
}

function GhostStats({
  walkerSlotTotal,
  walkerLatticeNodes,
  linkCount,
  topologyDebug,
  modeledLiveDelta,
  shellDeltaByGen,
  transitCount,
}: Pick<
  OrbitalOpsChromeProps,
  | 'walkerSlotTotal'
  | 'walkerLatticeNodes'
  | 'linkCount'
  | 'topologyDebug'
  | 'modeledLiveDelta'
  | 'shellDeltaByGen'
  | 'transitCount'
>) {
  return (
    <>
      <div className="mesh-stat-row">
        <span>ghost slots</span>
        <b>{walkerSlotTotal.toLocaleString()}</b>
      </div>
      <div className="mesh-stat-row">
        <span>scaled lattice</span>
        <b>{walkerLatticeNodes.toLocaleString()}</b>
      </div>
      <div className="mesh-stat-row">
        <span>ghost links</span>
        <b>{linkCount.toLocaleString()}</b>
      </div>
      {topologyDebug && (
        <>
          <div
            className="mesh-stat-row orbital-ops-debug-divider"
            title="Walker ghost nodes vs fleet target"
          >
            <span>drawn nodes</span>
            <b>
              {topologyDebug.visibleNodes.toLocaleString()}/
              {topologyDebug.walkerReferenceTotal.toLocaleString()}
            </b>
          </div>
          <div className="mesh-stat-row">
            <span>drawn edges</span>
            <b>
              {topologyDebug.drawnEdges.toLocaleString()}/
              {topologyDebug.generatedEdges.toLocaleString()}
            </b>
          </div>
        </>
      )}
      {modeledLiveDelta != null && (
        <>
          <div
            className="mesh-stat-row"
            title="McDowell-scaled granted Walker reference minus live TLE in granted shells (transit excluded)"
          >
            <span>Δ modeled−live</span>
            <b>+{modeledLiveDelta.toLocaleString()}</b>
          </div>
          <div className="mesh-stat-row" title="Gen1 scaled Walker reference minus live">
            <span>Δ Gen1</span>
            <b className="tabular-nums">+{shellDeltaByGen.gen1.toLocaleString()}</b>
          </div>
          <div className="mesh-stat-row" title="Gen2 scaled Walker reference minus live">
            <span>Δ Gen2</span>
            <b className="tabular-nums">+{shellDeltaByGen.gen2.toLocaleString()}</b>
          </div>
        </>
      )}
      {transitCount != null && (
        <div className="mesh-stat-row" title="Orbit-raising/deorbiting — excluded from Δ">
          <span>transit</span>
          <b className="tabular-nums">{transitCount.toLocaleString()}</b>
        </div>
      )}
    </>
  );
}

function GlobeStripInner({
  compact,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`orbital-ops-globe-strip${compact ? ' orbital-ops-globe-strip--mobile flex md:hidden' : ' hidden md:flex'}`}
      aria-live="polite"
    >
      <div className="orbital-ops-globe-strip-inner">{children}</div>
    </div>
  );
}

function tleStripBadgeClass(tone: TleStripTone): string {
  if (tone === 'live') return 'orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--live';
  if (tone === 'stale') return 'orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--stale';
  if (tone === 'offline') return 'orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--offline';
  return 'orbital-ops-globe-strip-badge';
}

function TleStripStateBadge({ strip }: { strip: TleStripBadge }) {
  if (!strip.label) return null;
  return (
    <span className={tleStripBadgeClass(strip.tone)} title={strip.title}>
      {strip.label}
    </span>
  );
}

function LaunchHonestyBanner({
  highlight,
  compact,
  onClear,
}: {
  highlight: NonNullable<OrbitalOpsChromeProps['manifestLaunchHighlight']>;
  compact?: boolean;
  onClear?: () => void;
}) {
  const honesty = launchHighlightHonesty({
    matchedVia: highlight.matchedVia,
    satCount: highlight.count,
    failed: highlight.failed,
    catalogReady: highlight.catalogReady,
  });
  return (
    <div className="orbital-ops-manifest-hl" role="status">
      <div className="orbital-ops-manifest-hl-title">{honesty.title}</div>
      <div className="orbital-ops-manifest-hl-body">
        {highlight.label}
        {highlight.launchTag ? ` · ${highlight.launchTag}` : ''}
        {honesty.paint
          ? compact
            ? ` · ${highlight.count}`
            : ` · ${highlight.count} sat${highlight.count === 1 ? '' : 's'}`
          : ''}
        {` · ${honesty.how}`}
      </div>
      {onClear ? (
        <button type="button" className="orbital-ops-manifest-hl-clear" onClick={onClear}>
          {compact ? 'Clear' : 'Clear highlight'}
        </button>
      ) : null}
    </div>
  );
}

/** Overlay chrome for Orbital Ops — DOM only; never owns the WebGL scene. */
export function OrbitalOpsChrome(props: OrbitalOpsChromeProps) {
  const { distanceUnit } = useUserSettings();
  const {
    showGhostGrid,
    setShowGhostGrid,
    showPlaneArcs,
    setShowPlaneArcs,
    showCoverageCone,
    setShowCoverageCone,
    autoSpin,
    setAutoSpin,
    bumpResetView,
    walkerLatticeNodes,
    walkerSlotTotal,
    mcdowellSnapshotDate,
    fleetTierKpis,
    kpisLoading,
    deploymentKey,
    setDeploymentKey,
    launchOptions,
    activeDeployment,
    activeHighlightCount,
    manifestLaunchHighlight = null,
    onClearManifestLaunchHighlight,
    speedSlider,
    setSpeedSlider,
    sizeSlider,
    setSizeSlider,
    altSlider,
    setAltSlider,
    speedLabel,
    nodeScale,
    altExag,
    visibleShells,
    shellSlotCount,
    toggleShell,
    toggleAllShells,
    shellCounts,
    nodeCount,
    liveAvailable,
    earthVisual,
    toggleEarthVisual,
    topologyDebug,
    linkCount,
    modeledLiveDelta,
    shellDeltaByGen,
    transitCount,
    liveLoading,
    liveError,
    liveCatalog,
    noradUnknown = null,
    selectedNoradId,
    setSelectedNoradId,
    tleSourceLabel,
    catalogStale,
    catalogFreshnessLabel,
    workerIsolated = true,
    displayEpoch,
    hover,
    selectedLaunchPad = null,
    onOpenManifestPad,
    conjunctions = null,
    conjunctionsLoading = false,
    conjunctionsError = null,
    showConjunctions = true,
    setShowConjunctions,
    selectedConjunctionId = null,
    setSelectedConjunctionId,
    onRefreshConjunctions,
    epochPlayback,
  } = props;

  const tleStrip = tleStripBadge({
    liveLoading,
    liveError,
    liveCatalog,
    playbackDate: epochPlayback?.playbackDate ?? liveCatalog?.playbackDate ?? null,
    catalogStale,
  });
  const launchHonesty = manifestLaunchHighlight
    ? launchHighlightHonesty({
        matchedVia: manifestLaunchHighlight.matchedVia,
        satCount: manifestLaunchHighlight.count,
        failed: manifestLaunchHighlight.failed,
        catalogReady: manifestLaunchHighlight.catalogReady,
      })
    : null;

  return (
    <>
      <div className="orbital-ops-chrome">
        <aside className="orbital-ops-left hidden md:flex">
          <div className="mesh-overlay orbital-ops-sat-counts">
            <div
              className={`orbital-ops-sat-count-card orbital-ops-sat-count-card--walker${showGhostGrid ? ' orbital-ops-sat-count-card--active' : ''}`}
            >
              <div className="orbital-ops-sat-count-label">Walker reference</div>
              <div className="orbital-ops-sat-count-value">{walkerLatticeNodes.toLocaleString()}</div>
              <div className="orbital-ops-sat-count-sub">
                of {walkerSlotTotal.toLocaleString()} FCC granted slots · McDowell-scaled ·{' '}
                {mcdowellSnapshotDate}
              </div>
            </div>
            <FleetTierKpiCards kpis={fleetTierKpis} loading={kpisLoading} />
          </div>

          {noradUnknown != null ? (
            <div className="orbital-ops-manifest-hl" role="status">
              <div className="orbital-ops-manifest-hl-title">Unknown NORAD</div>
              <div className="orbital-ops-manifest-hl-body">
                NORAD {noradUnknown} is not in the live catalog — no fake point.
              </div>
            </div>
          ) : null}
          {manifestLaunchHighlight ? (
            <LaunchHonestyBanner
              highlight={manifestLaunchHighlight}
              onClear={onClearManifestLaunchHighlight}
            />
          ) : null}

          <DockFold
            summary="controls"
            hint={viewMenuSummary({
              autoSpin,
              showGhostGrid,
              showPlaneArcs,
              showCoverageCone,
            })}
          >
            <div className="mesh-overlay orbital-ops-panel-section">
              <span className="orbital-ops-dock-label">view</span>
              <ViewToggles
                autoSpin={autoSpin}
                setAutoSpin={setAutoSpin}
                bumpResetView={bumpResetView}
                showGhostGrid={showGhostGrid}
                setShowGhostGrid={setShowGhostGrid}
                showPlaneArcs={showPlaneArcs}
                setShowPlaneArcs={setShowPlaneArcs}
                showCoverageCone={showCoverageCone}
                setShowCoverageCone={setShowCoverageCone}
              />
            </div>

            <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--deploy">
              <span className="orbital-ops-dock-label">deployment filter</span>
              <select
                className="mesh-deploy-select w-full bg-[var(--ui-input-bg)]/80 border border-bbg-border-subtle/60 text-bbg-white text-[10px] px-2 py-1.5 rounded-sm font-mono tracking-wide"
                value={deploymentKey ?? ''}
                onChange={(e) => setDeploymentKey(e.target.value || null)}
              >
                <option value="">All satellites</option>
                {launchOptions.map((opt) => (
                  <option key={opt.launch.id} value={opt.launch.id}>
                    {opt.launch.name} · {opt.spec.count} sats
                    {opt.noradIds.size > 0 ? ` · ${opt.noradIds.size} matched` : ''}
                  </option>
                ))}
              </select>
              <p className="orbital-ops-dock-hint">
                {launchHonesty
                  ? launchHonesty.paint
                    ? `${activeHighlightCount} Manifest sats glow on the mesh`
                    : launchHonesty.title
                  : activeDeployment
                    ? showGhostGrid
                      ? 'Batch highlights live sats. Ghost grid shows full Walker reference.'
                      : `${activeHighlightCount} sats glow amber on the mesh`
                    : 'isolate a Falcon batch on live TLE mesh'}
              </p>
            </div>

            <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--sliders">
              <div className="mesh-control-label">
                orbit time <b>{speedLabel}</b>
              </div>
              <input
                type="range"
                className="mesh-range"
                min={0}
                max={100}
                value={speedSlider}
                onChange={(e) => setSpeedSlider(Number(e.target.value))}
              />
              <div className="mesh-control-label">
                node scale <b>{nodeScale.toFixed(1)}×</b>
              </div>
              <input
                type="range"
                className="mesh-range"
                min={40}
                max={180}
                value={sizeSlider}
                onChange={(e) => setSizeSlider(Number(e.target.value))}
              />
              <div className="mesh-control-label">
                altitude exag <b>{altExagLabel(altExag)}</b>
              </div>
              <input
                type="range"
                className="mesh-range"
                min={0}
                max={100}
                value={altSlider}
                onChange={(e) => setAltSlider(Number(e.target.value))}
              />
            </div>

            {epochPlayback ? <TleEpochPlaybackScrubber playback={epochPlayback} /> : null}

            <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--shells">
              <StarlinkShellFilter
                visibleShells={visibleShells}
                onToggle={toggleShell}
                onToggleAll={toggleAllShells}
                shellCounts={shellCounts}
                totalCount={liveAvailable ? nodeCount : null}
                showGhostGrid={showGhostGrid}
                liveAvailable={liveAvailable}
              />
            </div>

            <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--earth">
              <span className="orbital-ops-dock-label">earth visuals</span>
              <EarthVisualToggles earthVisual={earthVisual} toggleEarthVisual={toggleEarthVisual} />
            </div>

            <div className="mesh-overlay orbital-ops-stats orbital-ops-panel-section">
              {showGhostGrid && (
                <GhostStats
                  walkerSlotTotal={walkerSlotTotal}
                  walkerLatticeNodes={walkerLatticeNodes}
                  linkCount={linkCount}
                  topologyDebug={topologyDebug}
                  modeledLiveDelta={modeledLiveDelta}
                  shellDeltaByGen={shellDeltaByGen}
                  transitCount={transitCount}
                />
              )}
              {tleStrip.kind === 'syncing' && (
                <div className="mesh-stat-row">
                  <span>TLE</span>
                  <b className="text-bbg-muted">loading…</b>
                </div>
              )}
              {tleStrip.kind === 'offline' && liveError && (
                <div className="mesh-stat-row">
                  <span>TLE</span>
                  <b className="text-bbg-red">offline</b>
                </div>
              )}
              {tleStrip.kind === 'offline' && (
                <div className="mesh-stat-row" title={tleStrip.title}>
                  <span>live feed</span>
                  <b>{tleStrip.label === 'never loaded' ? 'never loaded · ghost' : 'offline · ghost'}</b>
                </div>
              )}
              {activeDeployment && (
                <div className="mesh-stat-row">
                  <span>filtered</span>
                  <b>{activeHighlightCount}</b>
                </div>
              )}
              <div className="mesh-stat-row">
                <span>time</span>
                <b>{speedLabel}</b>
              </div>
            </div>

            <div className="mesh-overlay orbital-ops-satellite">
              <StarlinkSatellitePanel
                catalog={liveCatalog}
                selectedNoradId={selectedNoradId}
                launchOptions={launchOptions}
                onSelect={setSelectedNoradId}
              />
            </div>

            {setShowConjunctions && setSelectedConjunctionId && onRefreshConjunctions ? (
              <div className="mesh-overlay orbital-ops-panel-section conj-panel-wrap pointer-events-auto">
                <ConjunctionPanel
                  snapshot={conjunctions}
                  loading={conjunctionsLoading}
                  error={conjunctionsError}
                  selectedId={selectedConjunctionId}
                  onSelect={setSelectedConjunctionId}
                  onRefresh={onRefreshConjunctions}
                  showOverlay={showConjunctions}
                  onToggleOverlay={() => setShowConjunctions((v) => !v)}
                />
              </div>
            ) : null}
          </DockFold>
        </aside>

        <GlobeStripInner>
          <div className="orbital-ops-globe-strip-row">
            <span className="orbital-ops-globe-strip-label">TLE</span>
            <span className="orbital-ops-globe-strip-value">{tleSourceLabel}</span>
            {!workerIsolated ? (
              <span
                className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--stale"
                title="Cross-origin isolation missing — SharedArrayBuffer worker unavailable; SGP4 on main thread"
              >
                main-thread prop
              </span>
            ) : null}
            <TleStripStateBadge strip={tleStrip} />
          </div>
          {noradUnknown != null ? (
            <div className="orbital-ops-globe-strip-row" role="status">
              <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--offline">
                unknown norad
              </span>
              <span>{String(noradUnknown)} is not in the live catalog</span>
            </div>
          ) : null}
          <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--counts">
            <span className="tabular-nums">{walkerSlotTotal.toLocaleString()} FCC slots</span>
            <span className="orbital-ops-globe-strip-sep">·</span>
            <span className="tabular-nums">
              {tleStrip.trackedText} TLE tracked
            </span>
          </div>
          <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--meta">
            <span>EPOCH</span>
            <span className="tabular-nums" title={displayEpoch.displayEpochIso}>
              {displayEpoch.displayLabel}
            </span>
            {displayEpoch.enrichStale && (
              <>
                <span className="orbital-ops-globe-strip-sep">·</span>
                <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--stale">
                  ENRICH-OLD
                </span>
              </>
            )}
            {catalogFreshnessLabel && tleStrip.paint && (
              <>
                <span className="orbital-ops-globe-strip-sep">·</span>
                <span className="tabular-nums">TLE {catalogFreshnessLabel}</span>
              </>
            )}
          </div>
          {showGhostGrid && (
            <div
              className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--meta"
              title="Synthetic FCC lattice — not NORAD positions"
            >
              <span>Lattice</span>
              <span className="tabular-nums">{walkerLatticeNodes.toLocaleString()} scaled</span>
              <span className="orbital-ops-globe-strip-sep">·</span>
              <span>{linkCount.toLocaleString()} ISL links</span>
            </div>
          )}
        </GlobeStripInner>

        <div className="orbital-ops-stats-mobile flex flex-col md:hidden">
          <div className="mesh-overlay orbital-ops-sat-counts">
            <div
              className={`orbital-ops-sat-count-card orbital-ops-sat-count-card--walker${showGhostGrid ? ' orbital-ops-sat-count-card--active' : ''}`}
            >
              <div className="orbital-ops-sat-count-label">Walker reference</div>
              <div className="orbital-ops-sat-count-value">{walkerLatticeNodes.toLocaleString()}</div>
            </div>
            <FleetTierKpiCards kpis={fleetTierKpis} loading={kpisLoading} />
            {visibleShells.size < shellSlotCount && (
              <div className="orbital-ops-sat-count-active">
                <span className="orbital-ops-sat-count-label">Filtered on mesh</span>
                <b className="orbital-ops-sat-count-value">{nodeCount.toLocaleString()}</b>
              </div>
            )}
          </div>

          {noradUnknown != null ? (
            <div className="orbital-ops-manifest-hl" role="status">
              <div className="orbital-ops-manifest-hl-title">Unknown NORAD</div>
              <div className="orbital-ops-manifest-hl-body">
                NORAD {noradUnknown} is not in the live catalog — no fake point.
              </div>
            </div>
          ) : null}
          {manifestLaunchHighlight ? (
            <LaunchHonestyBanner
              highlight={manifestLaunchHighlight}
              compact
              onClear={onClearManifestLaunchHighlight}
            />
          ) : null}

          <DockFold
            summary="controls"
            hint={viewMenuSummary({
              autoSpin,
              showGhostGrid,
              showPlaneArcs,
              showCoverageCone,
            })}
          >
            <div className="mesh-overlay orbital-ops-panel-section">
              <span className="orbital-ops-dock-label">view</span>
              <ViewToggles
                autoSpin={autoSpin}
                setAutoSpin={setAutoSpin}
                bumpResetView={bumpResetView}
                showGhostGrid={showGhostGrid}
                setShowGhostGrid={setShowGhostGrid}
                showPlaneArcs={showPlaneArcs}
                setShowPlaneArcs={setShowPlaneArcs}
                showCoverageCone={showCoverageCone}
                setShowCoverageCone={setShowCoverageCone}
              />
            </div>

            <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--deploy">
              <span className="orbital-ops-dock-label">deployment filter</span>
              <select
                className="mesh-deploy-select w-full bg-[var(--ui-input-bg)]/80 border border-bbg-border-subtle/60 text-bbg-white text-[9px] px-2 py-1 rounded-sm font-mono"
                value={deploymentKey ?? ''}
                onChange={(e) => setDeploymentKey(e.target.value || null)}
              >
                <option value="">All Starlink sats</option>
                {launchOptions.map((opt) => (
                  <option key={opt.launch.id} value={opt.launch.id}>
                    {opt.launch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mesh-overlay orbital-ops-panel-section pointer-events-auto">
              <StarlinkShellFilter
                visibleShells={visibleShells}
                onToggle={toggleShell}
                onToggleAll={toggleAllShells}
                shellCounts={shellCounts}
                totalCount={liveAvailable ? nodeCount : null}
                showGhostGrid={showGhostGrid}
                liveAvailable={liveAvailable}
              />
            </div>

            {epochPlayback ? (
              <div className="pointer-events-auto">
                <TleEpochPlaybackScrubber playback={epochPlayback} />
              </div>
            ) : null}

            <div className="mesh-overlay orbital-ops-panel-section">
              <span className="orbital-ops-dock-label">earth visuals</span>
              <EarthVisualToggles earthVisual={earthVisual} toggleEarthVisual={toggleEarthVisual} />
            </div>
          </DockFold>
        </div>
      </div>

      <GlobeStripInner compact>
        <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--counts">
          <span className="tabular-nums">{walkerSlotTotal.toLocaleString()} slots</span>
          <span className="orbital-ops-globe-strip-sep">·</span>
          <span className="tabular-nums">
            {tleStrip.trackedText} TLE
          </span>
          <TleStripStateBadge strip={tleStrip} />
        </div>
        {noradUnknown != null ? (
          <div className="orbital-ops-globe-strip-row" role="status">
            <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--offline">
              unknown norad
            </span>
            <span>{String(noradUnknown)} is not in the live catalog</span>
          </div>
        ) : null}
        <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--meta">
          <span>EPOCH {displayEpoch.displayLabel}</span>
          {displayEpoch.enrichStale && (
            <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--stale">
              ENRICH-OLD
            </span>
          )}
        </div>
        {showGhostGrid && (
          <div
            className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--meta"
            title="Synthetic FCC lattice — not NORAD positions"
          >
            <span>Lattice {walkerLatticeNodes.toLocaleString()}</span>
            <span className="orbital-ops-globe-strip-sep">·</span>
            <span>{linkCount.toLocaleString()} links</span>
          </div>
        )}
        <div
          className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--meta orbital-ops-mesh-legend"
          title="Shell class table. Stale TLE dims the same hue — not a second palette. Pad sites: red idle · green launch day (UTC)."
        >
          <span className="orbital-ops-mesh-legend-item">
            <i className="orbital-ops-mesh-legend-sat" aria-hidden />
            sats
          </span>
          <span className="orbital-ops-globe-strip-sep">·</span>
          <span className="orbital-ops-mesh-legend-item" title="Same shell hue, dimmed">
            <i className="orbital-ops-mesh-legend-sat orbital-ops-mesh-legend-sat--stale" aria-hidden />
            stale
          </span>
          <span className="orbital-ops-globe-strip-sep">·</span>
          <span className="orbital-ops-mesh-legend-item">
            <i className="orbital-ops-mesh-legend-pad" aria-hidden />
            pads
          </span>
          <span className="orbital-ops-globe-strip-sep">·</span>
          <span className="orbital-ops-mesh-legend-item">
            <i className="orbital-ops-mesh-legend-pad orbital-ops-mesh-legend-pad--hot" aria-hidden />
            launch day
          </span>
          <span className="orbital-ops-globe-strip-sep">·</span>
          <span className="orbital-ops-mesh-legend-item" title="CelesTrak SOCRATES close approaches">
            <i className="orbital-ops-mesh-legend-conj" aria-hidden />
            TCA
          </span>
        </div>
      </GlobeStripInner>

      {hover && hover.mode === 'live' && hover.noradId !== selectedNoradId && (
        <div
          className="mesh-tooltip"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 210),
            top: Math.min(hover.y + 16, window.innerHeight - 90),
          }}
        >
          <div className="text-bbg-white text-[11px] font-semibold tracking-wide">{hover.name}</div>
          <div className="text-bbg-muted text-[10px] mt-1 leading-relaxed">
            NORAD {hover.noradId} · {hover.shellName} incl. · {hover.inclination}° ·{' '}
            {formatDistanceKm(hover.altitudeKm, distanceUnit, 1)}
          </div>
          <div
            className="text-[10px] mt-1"
            style={{
              color: hover.epochStale
                ? 'var(--color-bbg-warn)'
                : 'var(--color-bbg-gray, var(--color-bbg-muted))',
            }}
            title={
              hover.product === 'oem'
                ? 'OEM Hermite — no SGP4 propagation growth'
                : 'SGP4 error grows ~1–3 km/day past TLE epoch'
            }
          >
            {hover.product === 'oem' ? 'OEM' : 'TLE'} age {hover.epochAgeHours}h
            {hover.epochStale ? ' · stale' : ''}
          </div>
          {(() => {
            const dep = deploymentForNoradId(hover.noradId, launchOptions);
            if (!dep) return null;
            return <div className="text-[10px] mt-1 leading-relaxed">◈ {dep.launch.name}</div>;
          })()}
        </div>
      )}

      {hover && hover.mode === 'launch' && (
        <div
          className="mesh-tooltip"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 240),
            top: Math.min(hover.y + 16, window.innerHeight - 100),
          }}
        >
          <div className="text-bbg-white text-[11px] font-semibold tracking-wide">{hover.name}</div>
          <div className="text-bbg-muted text-[10px] mt-1 leading-relaxed">
            {hover.pad ?? 'Pad TBD'}
            {hover.activeToday
              ? ' · launch day'
              : hover.active
                ? ' · on pad / near NET'
                : ' · idle'}
            {hover.launchCount > 1 ? ` · ${hover.launchCount} upcoming` : ''}
          </div>
          <div className="text-bbg-gray text-[10px] mt-1 uppercase tracking-wide">
            {hover.statusKind}
          </div>
          <div className="text-bbg-muted text-[10px] mt-1">Click to select · open Manifest below</div>
        </div>
      )}

      {selectedLaunchPad ? (
        <div className="mesh-overlay orbital-ops-pad-select">
          <div className="text-bbg-white text-[11px] font-semibold tracking-wide">
            {selectedLaunchPad.name}
          </div>
          <div className="text-bbg-muted text-[10px] mt-0.5">
            {selectedLaunchPad.pad ?? 'Pad TBD'}
          </div>
          {onOpenManifestPad ? (
            <button
              type="button"
              className="orbital-ops-pad-manifest-btn"
              onClick={() => onOpenManifestPad(selectedLaunchPad.primaryLaunchKey)}
            >
              Open in Manifest
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
