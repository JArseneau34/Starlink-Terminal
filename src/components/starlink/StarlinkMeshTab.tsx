import { useEffect, useMemo, useState } from 'react';
import {
  buildDefaultStarlinkLaunchOptions,
  deploymentForNoradId,
  enrichLaunchOptionsWithLiveCatalog,
} from '../../data/starlinkDeployments';
import {
  altExagFromSlider,
  altExagLabel,
  buildStarlinkCatalog,
  DEFAULT_ALT_EXAG_SLIDER,
  DEFAULT_NODE_SCALE_SLIDER,
  DEFAULT_SPEED_SLIDER,
  speedFromSlider,
} from './starlinkCatalog';
import { StarlinkShellFilter } from './StarlinkShellFilter';
import { StarlinkMeshCanvas, type StarlinkHoverInfo, type StarlinkTopologyDebugInfo } from './StarlinkMeshCanvas';
import { DEFAULT_EARTH_VISUAL, type EarthVisualOptions } from './earthGlobe';
import { StarlinkInvestorDataDashboard } from './investor/StarlinkInvestorDataDashboard';
import { GlobalCatalogDashboard } from './investor/GlobalCatalogDashboard';
import { StarlinkSatellitePanel } from './StarlinkSatellitePanel';
import { useStarlinkCatalogData } from '../../hooks/useStarlinkCatalogData';
import { useStarlinkIntelData } from '../../hooks/useStarlinkIntelData';
import { useWalkerFitData } from '../../hooks/useWalkerFitData';
import { FleetTierKpiCards } from './FleetTierKpiCards';
import { computeFleetTierKpis } from '../../utils/fleetTierKpis';
import { resolveOrbitalDisplayEpoch } from '../../utils/orbitalDisplayEpoch';
import { shellCountsFromWalkerFit } from '../../utils/walkerFitView';
import {
  GRANTED_TOPOLOGY_TOTAL,
  resolveGrantedTopologyShells,
  resolveGrantedTopologyShellsScaled,
  shellSatCountFromSpec,
} from '../../data/starlinkShells';
import { isGrantedShellIndex } from '../../data/shellReference';
import { STARLINK_FLEET_SNAPSHOT } from '../../data/starlinkFleetSnapshot';
import {
  allOrbitalShellFilterIndices,
  ORBITAL_SHELL_FILTER_COUNT,
} from '../../data/orbitalShellClassification';

export function OrbitalOpsTab() {
  const [view, setView] = useState<'ops' | 'fleet' | 'global'>('ops');
  const fleetDashEnabled = view === 'fleet';
  const globalDashEnabled = view === 'global';
  const topologyShells = useMemo(() => resolveGrantedTopologyShells(), []);
  const {
    data: liveCatalog,
    isLoading: liveLoading,
    error: liveError,
  } = useStarlinkCatalogData(true);
  const { data: fleetIntel, isLoading: intelLoading } = useStarlinkIntelData(view === 'ops');
  const walkerFleetTarget =
    fleetIntel?.authoritative.totalWorking ?? STARLINK_FLEET_SNAPSHOT.totalWorking;
  const { edgeA, walkerReferenceTotal } = useMemo(
    () => buildStarlinkCatalog(walkerFleetTarget),
    [walkerFleetTarget]
  );

  const fleetTierKpis = useMemo(
    () => computeFleetTierKpis(liveCatalog, fleetIntel),
    [liveCatalog, fleetIntel]
  );

  const baseLaunchOptions = useMemo(
    () => buildDefaultStarlinkLaunchOptions(topologyShells),
    [topologyShells]
  );
  const launchOptions = useMemo(
    () => enrichLaunchOptionsWithLiveCatalog(baseLaunchOptions, liveCatalog?.satellites),
    [baseLaunchOptions, liveCatalog?.satellites]
  );
  const [deploymentKey, setDeploymentKey] = useState<string | null>(null);
  const activeDeployment = useMemo(
    () => launchOptions.find((o) => o.launch.id === deploymentKey) ?? null,
    [launchOptions, deploymentKey]
  );

  const [speedSlider, setSpeedSlider] = useState(DEFAULT_SPEED_SLIDER);
  const [sizeSlider, setSizeSlider] = useState(DEFAULT_NODE_SCALE_SLIDER);
  const [altSlider, setAltSlider] = useState(DEFAULT_ALT_EXAG_SLIDER);
  const [autoSpin, setAutoSpin] = useState(true);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [earthVisual, setEarthVisual] = useState<EarthVisualOptions>(DEFAULT_EARTH_VISUAL);
  const [hover, setHover] = useState<StarlinkHoverInfo | null>(null);
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
  const [visibleShells, setVisibleShells] = useState<ReadonlySet<number>>(() =>
    allOrbitalShellFilterIndices()
  );
  const [topologyDebug, setTopologyDebug] = useState<StarlinkTopologyDebugInfo | null>(null);
  const [showGhostGrid, setShowGhostGrid] = useState(true);
  const { fit: walkerFit } = useWalkerFitData(view === 'ops');

  const shellSlotCount = ORBITAL_SHELL_FILTER_COUNT;

  useEffect(() => {
    setVisibleShells(allOrbitalShellFilterIndices());
  }, []);

  const toggleEarthVisual = (key: keyof EarthVisualOptions) => {
    setEarthVisual((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleShell = (shellIndex: number) => {
    setVisibleShells((prev) => {
      const next = new Set(prev);
      if (next.has(shellIndex)) {
        next.delete(shellIndex);
      } else {
        next.add(shellIndex);
      }
      return next;
    });
  };

  const toggleAllShells = () => {
    setVisibleShells((prev) =>
      prev.size >= shellSlotCount
        ? new Set<number>()
        : allOrbitalShellFilterIndices()
    );
  };

  const liveCatalogUnavailable =
    !liveLoading && (liveCatalog == null || liveCatalog.count === 0);
  const liveAvailable =
    !liveLoading &&
    !liveError &&
    !liveCatalogUnavailable &&
    liveCatalog != null &&
    liveCatalog.count > 0 &&
    liveCatalog.tleOffline !== true &&
    fleetIntel?.liveTleAvailable !== false;

  const shellCounts = useMemo(
    () => shellCountsFromWalkerFit(walkerFit, liveAvailable),
    [walkerFit, liveAvailable]
  );

  const transitCount = useMemo(() => {
    if (!liveAvailable) return null;
    return walkerFit?.transitCount ?? 0;
  }, [liveAvailable, walkerFit?.transitCount]);

  const liveInGrantedShells = useMemo(() => {
    if (!liveCatalog) return 0;
    return liveCatalog.satellites.filter((s) => isGrantedShellIndex(s.shell)).length;
  }, [liveCatalog]);

  const scaledGrantedShells = useMemo(
    () => resolveGrantedTopologyShellsScaled(walkerFleetTarget),
    [walkerFleetTarget]
  );

  const shellDeltaByGen = useMemo(() => {
    const gen1Target = scaledGrantedShells
      .filter((s) => s.constellationGen === 'gen1')
      .reduce((sum, s) => sum + shellSatCountFromSpec(s), 0);
    const gen2Target = scaledGrantedShells
      .filter((s) => s.constellationGen === 'gen2')
      .reduce((sum, s) => sum + shellSatCountFromSpec(s), 0);
    const gen1Live =
      liveCatalog?.satellites.filter(
        (s) => isGrantedShellIndex(s.shell) && s.shell >= 0 && s.shell <= 4
      ).length ?? 0;
    const gen2Live =
      liveCatalog?.satellites.filter((s) => isGrantedShellIndex(s.shell) && s.shell >= 5 && s.shell <= 7)
        .length ?? 0;
    return {
      gen1: gen1Target - gen1Live,
      gen2: gen2Target - gen2Live,
    };
  }, [scaledGrantedShells, liveCatalog]);

  const visibleNodeCount = useMemo(() => {
    if (visibleShells.size >= shellSlotCount) {
      return liveCatalog?.count ?? 0;
    }
    if (liveCatalog?.shells) {
      return liveCatalog.shells
        .filter((sh) => visibleShells.has(sh.index))
        .reduce((sum, sh) => sum + sh.count, 0);
    }
    if (liveCatalog) {
      return liveCatalog.satellites.filter((s) => visibleShells.has(s.shell)).length;
    }
    return 0;
  }, [visibleShells, liveCatalog, shellSlotCount]);

  const handleSatelliteSelect = (info: StarlinkHoverInfo | null) => {
    setSelectedNoradId(info?.mode === 'live' ? info.noradId : null);
  };

  const speedMul = speedFromSlider(speedSlider);
  const nodeScale = sizeSlider / 100;
  const altExag = altExagFromSlider(altSlider);
  const nodeCount = visibleNodeCount;
  const linkCount = edgeA.length;
  const walkerSlotTotal = walkerFit?.grantedSlotTotal ?? GRANTED_TOPOLOGY_TOTAL;
  const walkerLatticeNodes = topologyDebug?.walkerReferenceTotal ?? walkerReferenceTotal;
  const liveTotal = liveCatalog?.count ?? 0;
  const activeHighlightCount = activeDeployment?.noradIds.size ?? 0;
  const speedLabel = speedMul <= 0 ? 'real-time' : `${speedMul}× sim`;

  const modeledLiveDelta =
    liveAvailable && liveInGrantedShells > 0 ? walkerLatticeNodes - liveInGrantedShells : null;

  const displayEpoch = useMemo(
    () =>
      resolveOrbitalDisplayEpoch({
        liveCatalog,
        walkerFit,
        fleetSnapshotDate: fleetIntel?.authoritative.snapshotDate,
        tleOffline: liveCatalog?.tleOffline === true || !liveAvailable,
        liveAvailable,
      }),
    [liveCatalog, walkerFit, fleetIntel?.authoritative.snapshotDate, liveAvailable]
  );

  const mcdowellSnapshotDate = displayEpoch.mcdowellSnapshotDate;

  const tleSourceLabel = (() => {
    if (liveError || liveCatalogUnavailable) return 'offline';
    const src = liveCatalog?.tleSource;
    if (src === 'group') return 'CelesTrak group';
    if (src === 'name') return 'CelesTrak name';
    if (src === 'tleapi') return 'TLE API';
    if (src === 'cache') return 'cached TLE';
    return 'CelesTrak TLE';
  })();

  const catalogFreshnessLabel = (() => {
    if (!liveCatalog?.tleFetchedAt) return null;
    const ageMs = Date.now() - Date.parse(liveCatalog.tleFetchedAt);
    if (!Number.isFinite(ageMs)) return null;
    const mins = Math.round(ageMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  })();

  const catalogStale =
    !liveLoading &&
    !liveError &&
    liveCatalog != null &&
    liveCatalog.count > 0 &&
    (liveCatalog.tleOffline === true ||
      (catalogFreshnessLabel != null &&
        Date.now() - Date.parse(liveCatalog.tleFetchedAt) > 2 * 3_600_000));

  return (
    <div className={`orbital-ops-shell orbital-ops-shell--${view} flex-1 flex flex-col min-h-0 overflow-hidden panel-surface`}>
      <div className="orbital-ops-topbar">
        <div className="orbital-ops-brand">
          <div className="orbital-ops-brand-title">Sat Stats</div>
          <div className="text-[9px] text-bbg-muted tracking-wider mt-0.5 orbital-ops-title-sub">
            {view === 'ops'
              ? showGhostGrid
                ? 'live TLE catalog · Walker reference grid'
                : 'live TLE catalog'
              : view === 'fleet'
                ? 'fleet data · launch archive · chart feeds · review queue'
                : 'global catalog · GCAT · all launches & satellites'}
            {view === 'ops' && liveCatalog && liveCatalog.count > 0 ? (
              <span className="ml-2 tabular-nums">
                · {liveCatalog.count.toLocaleString()} tracked
              </span>
            ) : null}
          </div>
        </div>
        <nav className="subtab-nav orbital-ops-tabs">
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--ops ${view === 'ops' ? 'subtab-btn-active' : ''}`}
            onClick={() => setView('ops')}
          >
            Orbital Ops
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--fleet ${view === 'fleet' ? 'subtab-btn-active starlink-investor-subtab--fleet' : ''}`}
            onClick={() => setView('fleet')}
          >
            Fleet Data
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab orbital-ops-tab--global ${view === 'global' ? 'subtab-btn-active starlink-investor-subtab--global' : ''}`}
            onClick={() => setView('global')}
          >
            Global Catalog
          </button>
        </nav>
      </div>

      <div className="orbital-ops-body flex-1 relative min-h-0">
      {view === 'fleet' ? (
        <div className="starlink-investor-view">
          <StarlinkInvestorDataDashboard enabled={fleetDashEnabled} />
        </div>
      ) : view === 'global' ? (
        <div className="starlink-investor-view">
          <GlobalCatalogDashboard enabled={globalDashEnabled} />
        </div>
      ) : (
      <>
      <StarlinkMeshCanvas
        speedMul={speedMul}
        nodeScale={nodeScale}
        altExag={altExag}
        autoSpin={autoSpin}
        resetViewToken={resetViewToken}
        onHover={setHover}
        onSelect={handleSatelliteSelect}
        onTopologyDebug={setTopologyDebug}
        selectedNoradId={selectedNoradId}
        highlightedNoradIds={activeDeployment?.noradIds ?? null}
        deploymentFilterKey={deploymentKey}
        visibleShells={visibleShells}
        shellSlotCount={shellSlotCount}
        liveCatalog={liveCatalog}
        walkerFleetTarget={walkerFleetTarget}
        showGhostGrid={showGhostGrid}
        displayEpochIso={displayEpoch.displayEpochIso}
        walkerFit={walkerFit}
        liveAvailable={liveAvailable}
        earthVisual={earthVisual}
      />

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
            <FleetTierKpiCards kpis={fleetTierKpis} loading={liveLoading || intelLoading} />
          </div>

          <div className="mesh-overlay orbital-ops-panel-section">
            <span className="orbital-ops-dock-label">view</span>
            <div className="mesh-toggles mesh-toggles--wrap mb-0">
              <button
                type="button"
                className={`mesh-toggle ${autoSpin ? 'mesh-toggle-on' : ''}`}
                onClick={() => setAutoSpin((v) => !v)}
              >
                auto-spin
              </button>
              <button
                type="button"
                className="mesh-toggle"
                onClick={() => setResetViewToken((t) => t + 1)}
              >
                reset view
              </button>
            </div>
            <div className="mesh-toggles mb-0 mt-1.5">
              <button
                type="button"
                className={`mesh-toggle mesh-toggle--ghost${showGhostGrid ? ' mesh-toggle-on' : ''}`}
                onClick={() => setShowGhostGrid((v) => !v)}
                title="Show Walker ISL reference grid under live TLE positions"
              >
                ghost grid
              </button>
            </div>
          </div>

          <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--deploy">
            <span className="orbital-ops-dock-label">deployment filter</span>
            <select
              className="mesh-deploy-select w-full bg-[#0a0a12]/80 border border-bbg-border-subtle/60 text-bbg-white text-[10px] px-2 py-1.5 rounded-sm font-mono tracking-wide"
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
              {activeDeployment
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
            <div className="mesh-toggles mesh-toggles--wrap mesh-earth-toggles mb-0">
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.dayMap ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('dayMap')}
                title="Blue marble day texture"
              >
                day map
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.nightLights ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('nightLights')}
                title="City lights on the night side"
              >
                night lights
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.terminator ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('terminator')}
                title="Sun-aligned day/night boundary"
              >
                terminator
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.atmosphere ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('atmosphere')}
              >
                atmosphere
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.graticule ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('graticule')}
              >
                graticule
              </button>
            </div>
          </div>

          <div className="mesh-overlay orbital-ops-stats orbital-ops-panel-section">
            {showGhostGrid && (
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
                        {topologyDebug.visibleNodes.toLocaleString()}/{topologyDebug.walkerReferenceTotal.toLocaleString()}
                      </b>
                    </div>
                    <div className="mesh-stat-row">
                      <span>drawn edges</span>
                      <b>
                        {topologyDebug.drawnEdges.toLocaleString()}/{topologyDebug.generatedEdges.toLocaleString()}
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
            )}
            {liveLoading && (
              <div className="mesh-stat-row">
                <span>TLE</span>
                <b className="text-bbg-muted">loading…</b>
              </div>
            )}
            {liveError && (
              <div className="mesh-stat-row">
                <span>TLE</span>
                <b className="text-bbg-red">offline</b>
              </div>
            )}
            {liveCatalogUnavailable && (
              <div className="mesh-stat-row" title="Live TLE feed offline — Walker ghost grid only.">
                <span>live feed</span>
                <b>offline · ghost</b>
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
        </aside>

        <div className="orbital-ops-globe-strip hidden md:flex" aria-live="polite">
          <div className="orbital-ops-globe-strip-inner">
            <div className="orbital-ops-globe-strip-row">
              <span className="orbital-ops-globe-strip-label">TLE</span>
              <span className="orbital-ops-globe-strip-value">{tleSourceLabel}</span>
              {liveError || liveCatalogUnavailable ? (
                <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--offline">
                  offline
                </span>
              ) : catalogStale ? (
                <span
                  className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--stale"
                  title={
                    liveCatalog?.tleOffline
                      ? 'Upstream TLE fetch failed — serving last good cache'
                      : 'TLE cache older than 2 hours'
                  }
                >
                  {liveCatalog?.tleOffline ? 'stale cache' : 'stale'}
                </span>
              ) : liveLoading ? (
                <span className="orbital-ops-globe-strip-badge">syncing</span>
              ) : (
                <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--live">
                  live
                </span>
              )}
            </div>
            <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--counts">
              <span className="tabular-nums">{walkerSlotTotal.toLocaleString()} FCC slots</span>
              <span className="orbital-ops-globe-strip-sep">·</span>
              <span className="tabular-nums">
                {liveLoading ? '…' : liveAvailable ? liveTotal.toLocaleString() : '—'} TLE tracked
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
              {catalogFreshnessLabel && liveAvailable && (
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
          </div>
        </div>

        <div className="orbital-ops-stats-mobile flex flex-col md:hidden">
          <div className="mesh-overlay orbital-ops-sat-counts">
            <div
              className={`orbital-ops-sat-count-card orbital-ops-sat-count-card--walker${showGhostGrid ? ' orbital-ops-sat-count-card--active' : ''}`}
            >
              <div className="orbital-ops-sat-count-label">Walker reference</div>
              <div className="orbital-ops-sat-count-value">{walkerLatticeNodes.toLocaleString()}</div>
            </div>
            <FleetTierKpiCards kpis={fleetTierKpis} loading={liveLoading || intelLoading} />
            {visibleShells.size < shellSlotCount && (
              <div className="orbital-ops-sat-count-active">
                <span className="orbital-ops-sat-count-label">Filtered on mesh</span>
                <b className="orbital-ops-sat-count-value">{nodeCount.toLocaleString()}</b>
              </div>
            )}
          </div>

          <div className="mesh-overlay orbital-ops-panel-section">
            <span className="orbital-ops-dock-label">view</span>
            <div className="mesh-toggles mesh-toggles--wrap mb-0">
              <button
                type="button"
                className={`mesh-toggle ${autoSpin ? 'mesh-toggle-on' : ''}`}
                onClick={() => setAutoSpin((v) => !v)}
              >
                auto-spin
              </button>
              <button
                type="button"
                className="mesh-toggle"
                onClick={() => setResetViewToken((t) => t + 1)}
              >
                reset view
              </button>
            </div>
            <div className="mesh-toggles mb-0 mt-1.5">
              <button
                type="button"
                className={`mesh-toggle mesh-toggle--ghost${showGhostGrid ? ' mesh-toggle-on' : ''}`}
                onClick={() => setShowGhostGrid((v) => !v)}
                title="Show Walker ISL reference grid under live TLE positions"
              >
                ghost grid
              </button>
            </div>
          </div>

          <div className="mesh-overlay orbital-ops-panel-section orbital-ops-dock-section--deploy">
            <span className="orbital-ops-dock-label">deployment filter</span>
            <select
              className="mesh-deploy-select w-full bg-[#0a0a12]/80 border border-bbg-border-subtle/60 text-bbg-white text-[9px] px-2 py-1 rounded-sm font-mono"
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

          <div className="mesh-overlay orbital-ops-panel-section">
            <span className="orbital-ops-dock-label">earth visuals</span>
            <div className="mesh-toggles mesh-toggles--wrap mesh-earth-toggles mb-0">
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.dayMap ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('dayMap')}
              >
                day map
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.nightLights ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('nightLights')}
              >
                night lights
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.terminator ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('terminator')}
              >
                terminator
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.atmosphere ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('atmosphere')}
              >
                atmosphere
              </button>
              <button
                type="button"
                className={`mesh-toggle ${earthVisual.graticule ? 'mesh-toggle-on' : ''}`}
                onClick={() => toggleEarthVisual('graticule')}
              >
                graticule
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="orbital-ops-globe-strip orbital-ops-globe-strip--mobile flex md:hidden" aria-live="polite">
        <div className="orbital-ops-globe-strip-inner">
          <div className="orbital-ops-globe-strip-row orbital-ops-globe-strip-row--counts">
            <span className="tabular-nums">{walkerSlotTotal.toLocaleString()} slots</span>
            <span className="orbital-ops-globe-strip-sep">·</span>
            <span className="tabular-nums">
              {liveLoading ? '…' : liveAvailable ? liveTotal.toLocaleString() : '—'} TLE
            </span>
            {(liveError || liveCatalogUnavailable) && (
              <span className="orbital-ops-globe-strip-badge orbital-ops-globe-strip-badge--offline">
                OFFLINE
              </span>
            )}
          </div>
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
        </div>
      </div>

      {hover && hover.mode === 'live' && hover.noradId !== selectedNoradId && (
        <div
          className="mesh-tooltip"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 210),
            top: Math.min(hover.y + 16, window.innerHeight - 90),
          }}
        >
          <div className="text-bbg-white text-[11px] font-semibold tracking-wide">
            {hover.name}
          </div>
          <div className="text-bbg-muted text-[10px] mt-1 leading-relaxed">
            NORAD {hover.noradId} · {hover.shellName} incl. · {hover.inclination}° ·{' '}
            {hover.altitudeKm} km
          </div>
          <div className="text-bbg-gray text-[10px] mt-1">
            TLE epoch age {hover.epochAgeHours}h
          </div>
          {(() => {
            const dep = deploymentForNoradId(hover.noradId, launchOptions);
            if (!dep) return null;
            return (
              <div className="text-[10px] mt-1 leading-relaxed">
                ◈ {dep.launch.name}
              </div>
            );
          })()}
        </div>
      )}
      </>
      )}
      </div>
    </div>
  );
}

/** @deprecated Use OrbitalOpsTab */
export const StarlinkMeshTab = OrbitalOpsTab;
