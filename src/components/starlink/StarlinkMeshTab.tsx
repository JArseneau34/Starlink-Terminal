import { useEffect, useMemo, useState } from 'react';
import type { StarlinkMeshMode } from '../../types/orbital';
import {
  buildDefaultStarlinkLaunchOptions,
  deploymentForNoradId,
  deploymentForSatelliteIndex,
  enrichLaunchOptionsWithLiveCatalog,
} from '../../data/starlinkDeployments';
import {
  altExagFromSlider,
  altExagLabel,
  buildStarlinkCatalog,
  DEFAULT_ALT_EXAG_SLIDER,
  DEFAULT_NODE_SCALE_SLIDER,
  DEFAULT_SPEED_SLIDER,
  shellSatCount,
  speedFromSlider,
  STARLINK_SHELLS,
} from './starlinkCatalog';
import { StarlinkShellFilter } from './StarlinkShellFilter';
import { StarlinkMeshCanvas, type StarlinkHoverInfo, type StarlinkTopologyDebugInfo } from './StarlinkMeshCanvas';
import { DEFAULT_EARTH_VISUAL, type EarthVisualOptions } from './earthGlobe';
import { StarlinkCatalystTimeline } from './StarlinkCatalystTimeline';
import { StarlinkDirectToCellTracker } from './StarlinkDirectToCellTracker';
import { StarlinkFleetPanel } from './StarlinkFleetPanel';
import { StarlinkInvestorKpiStrip } from './StarlinkInvestorKpiStrip';
import { StarlinkModelEconomicsPanel } from './StarlinkModelEconomicsPanel';
import { StarlinkRevenueScenarioPanel } from './StarlinkRevenueScenarioPanel';
import { StarlinkSatellitePanel } from './StarlinkSatellitePanel';
import { useStarlinkCatalogData } from '../../hooks/useStarlinkCatalogData';
import { useStarlinkIntelData } from '../../hooks/useStarlinkIntelData';
import { TOPOLOGY_FLEET_TARGET } from '../../data/starlinkShells';
import { VISUAL_SHELL_COUNT } from '../../data/starlinkVisualShells';

export function OrbitalOpsTab() {
  const { satellites, edgeA } = useMemo(() => buildStarlinkCatalog(), []);
  const [view, setView] = useState<'ops' | 'investor'>('ops');
  const [meshMode, setMeshMode] = useState<StarlinkMeshMode>('live');
  const [modePinned, setModePinned] = useState(false);
  const {
    data: liveCatalog,
    isLoading: liveLoading,
    error: liveError,
  } = useStarlinkCatalogData(true);
  const { data: starlinkIntel, isLoading: intelLoading } = useStarlinkIntelData(true);

  const baseLaunchOptions = useMemo(() => buildDefaultStarlinkLaunchOptions(), []);
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
  const [selectedTopologyIndex, setSelectedTopologyIndex] = useState<number | null>(null);
  const [visibleShells, setVisibleShells] = useState<ReadonlySet<number>>(
    () => new Set(STARLINK_SHELLS.map((_, i) => i))
  );
  const [topologyDebug, setTopologyDebug] = useState<StarlinkTopologyDebugInfo | null>(null);

  const shellSlotCount = meshMode === 'live' ? VISUAL_SHELL_COUNT : STARLINK_SHELLS.length;

  useEffect(() => {
    setVisibleShells(
      new Set(
        Array.from({ length: shellSlotCount }, (_, i) => i)
      )
    );
    if (meshMode === 'live') {
      setDeploymentKey(null);
    }
  }, [meshMode, shellSlotCount]);

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
        : new Set(Array.from({ length: shellSlotCount }, (_, i) => i))
    );
  };

  const shellCounts = useMemo(() => {
    if (meshMode === 'live' && liveCatalog?.shells) {
      return liveCatalog.shells.map((sh) => ({ shell: sh.index, count: sh.count }));
    }
    return STARLINK_SHELLS.map((sh, i) => ({
      shell: i,
      count: shellSatCount(sh),
    }));
  }, [meshMode, liveCatalog?.shells]);

  const visibleNodeCount = useMemo(() => {
    if (visibleShells.size >= shellSlotCount) {
      return meshMode === 'live' ? (liveCatalog?.count ?? 0) : satellites.length;
    }
    if (meshMode === 'live' && liveCatalog?.shells) {
      return liveCatalog.shells
        .filter((sh) => visibleShells.has(sh.index))
        .reduce((sum, sh) => sum + sh.count, 0);
    }
    if (meshMode === 'live' && liveCatalog) {
      return liveCatalog.satellites.filter((s) => visibleShells.has(s.shell)).length;
    }
    return satellites.filter((s) => visibleShells.has(s.shell)).length;
  }, [visibleShells, meshMode, liveCatalog, satellites, shellSlotCount]);

  const handleSatelliteSelect = (info: StarlinkHoverInfo | null) => {
    if (!info) {
      setSelectedNoradId(null);
      setSelectedTopologyIndex(null);
      return;
    }
    if (info.mode === 'live') {
      setSelectedNoradId(info.noradId);
      setSelectedTopologyIndex(null);
    } else {
      setSelectedTopologyIndex(info.index);
      setSelectedNoradId(null);
    }
  };

  const speedMul = speedFromSlider(speedSlider);
  const nodeScale = sizeSlider / 100;
  const altExag = altExagFromSlider(altSlider);
  const nodeCount = visibleNodeCount;
  const linkCount = meshMode === 'live' ? 0 : edgeA.length;
  const activeHighlightCount =
    meshMode === 'topology' ? (activeDeployment?.indices.size ?? 0) : 0;
  const speedLabel =
    meshMode === 'live' && speedMul <= 0 ? 'real-time' : `${speedMul}× ${meshMode === 'live' ? 'sim' : 'real'}`;
  const showLinks = meshMode === 'topology';

  const liveCatalogUnavailable =
    !liveLoading && (liveCatalog == null || liveCatalog.count === 0);

  // Live catalog is the factual view — prefer it when available unless the user pinned a mode.
  useEffect(() => {
    if (modePinned) return;
    if (!liveCatalogUnavailable && liveCatalog && liveCatalog.count > 0 && meshMode === 'topology') {
      setMeshMode('live');
    }
  }, [modePinned, liveCatalogUnavailable, liveCatalog, meshMode]);

  // When the live catalog is unreachable, fall back to the synthetic Walker topology.
  useEffect(() => {
    if (modePinned) return;
    if (liveCatalogUnavailable && meshMode === 'live') {
      setMeshMode('topology');
    }
  }, [modePinned, liveCatalogUnavailable, meshMode]);

  const selectMeshMode = (mode: StarlinkMeshMode) => {
    setModePinned(true);
    setMeshMode(mode);
  };

  return (
    <div className="orbital-ops-shell flex-1 flex flex-col min-h-0 overflow-hidden panel-surface">
      <div className="orbital-ops-topbar">
        <div className="orbital-ops-brand">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gradient-accent">
            Starlink Orbital Ops
          </div>
          <div className="text-[9px] text-bbg-muted tracking-wider mt-0.5 orbital-ops-title-sub">
            {view === 'ops'
              ? meshMode === 'live'
                ? 'live TLE catalog · image shell taxonomy · McDowell fleet target'
                : `Walker topology · synthetic model (${TOPOLOGY_FLEET_TARGET.toLocaleString()} nodes)`
              : 'revenue model · catalysts · unit economics'}
            {meshMode === 'live' && liveCatalog && liveCatalog.count > 0 ? (
              <span className="text-bbg-cyan ml-2 tabular-nums">
                · {liveCatalog.count.toLocaleString()} tracked
                {starlinkIntel ? (
                  <span className="text-bbg-muted">
                    {' '}
                    / McDowell {starlinkIntel.authoritative.totalWorking.toLocaleString()}
                  </span>
                ) : null}
              </span>
            ) : starlinkIntel && meshMode === 'topology' ? (
              <span className="text-bbg-muted ml-2 tabular-nums">
                · McDowell {starlinkIntel.authoritative.totalWorking.toLocaleString()} ref
              </span>
            ) : starlinkIntel ? (
              <span className="text-bbg-cyan ml-2 tabular-nums">
                · {starlinkIntel.totalTracked.toLocaleString()} NORAD
              </span>
            ) : null}
          </div>
        </div>
        <nav className="subtab-nav orbital-ops-tabs">
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab ${view === 'ops' ? 'subtab-btn-active' : ''}`}
            onClick={() => setView('ops')}
          >
            Orbital Ops
          </button>
          <button
            type="button"
            className={`subtab-btn orbital-ops-tab ${view === 'investor' ? 'subtab-btn-active' : ''}`}
            onClick={() => setView('investor')}
          >
            Investor
          </button>
        </nav>
      </div>

      <div className="orbital-ops-body flex-1 relative min-h-0">
      {view === 'investor' ? (
        <div className="starlink-investor-view">
          <StarlinkInvestorKpiStrip intel={starlinkIntel} isLoading={intelLoading} />
          <div className="starlink-investor-grid">
            <StarlinkRevenueScenarioPanel intel={starlinkIntel} isLoading={intelLoading} />
            <StarlinkCatalystTimeline intel={starlinkIntel} isLoading={intelLoading} />
            <div className="starlink-inv-block starlink-inv-block--econ">
              <StarlinkModelEconomicsPanel intel={starlinkIntel} isLoading={intelLoading} />
            </div>
            <div className="starlink-inv-block starlink-inv-block--dtc">
              <StarlinkDirectToCellTracker intel={starlinkIntel} isLoading={intelLoading} />
            </div>
          </div>
        </div>
      ) : (
      <>
      <StarlinkMeshCanvas
        meshMode={meshMode}
        speedMul={speedMul}
        nodeScale={nodeScale}
        altExag={altExag}
        showLinks={showLinks}
        autoSpin={autoSpin}
        resetViewToken={resetViewToken}
        onHover={setHover}
        onSelect={handleSatelliteSelect}
        onTopologyDebug={setTopologyDebug}
        selectedNoradId={selectedNoradId}
        selectedTopologyIndex={selectedTopologyIndex}
        highlightedIndices={meshMode === 'topology' ? (activeDeployment?.indices ?? null) : null}
        highlightedNoradIds={null}
        deploymentFilterKey={meshMode === 'topology' ? deploymentKey : null}
        visibleShells={visibleShells}
        shellSlotCount={shellSlotCount}
        liveCatalog={liveCatalog}
        earthVisual={earthVisual}
      />

      <div className="orbital-ops-chrome">
        <aside className="orbital-ops-left hidden md:flex">
          <div className="mesh-overlay orbital-ops-stats">
            <div className="mesh-stat-row">
              <span>mode</span>
              <b>{meshMode === 'live' ? 'live TLE' : 'topology'}</b>
            </div>
            <div className="mesh-stat-row">
              <span>{meshMode === 'live' ? 'tracked' : 'nodes'}</span>
              <b>{nodeCount.toLocaleString()}</b>
            </div>
            {meshMode === 'live' && liveCatalog && starlinkIntel && (
              <div
                className="mesh-stat-row"
                title={`McDowell working (${starlinkIntel.authoritative.snapshotDate}) — primary fleet count target; image NORAD ~10,548 includes transit TLEs`}
              >
                <span>McDowell ref</span>
                <b className="text-bbg-muted">
                  {starlinkIntel.authoritative.totalWorking.toLocaleString()}
                </b>
              </div>
            )}
            {meshMode === 'topology' && (
              <div className="mesh-stat-row" title={`Synthetic Walker grid scaled to McDowell total_working`}>
                <span>modeled</span>
                <b className="text-bbg-muted">{satellites.length.toLocaleString()}</b>
              </div>
            )}
            {visibleShells.size < shellSlotCount && (
              <div className="mesh-stat-row">
                <span>shells</span>
                <b className="text-bbg-cyan">{visibleShells.size} active</b>
              </div>
            )}
            {meshMode === 'topology' && (
              <div className="mesh-stat-row">
                <span>links</span>
                <b>{linkCount.toLocaleString()}</b>
              </div>
            )}
            {meshMode === 'live' && (
              <div className="mesh-stat-row">
                <span>links</span>
                <b>0</b>
              </div>
            )}
            {meshMode === 'topology' && topologyDebug && (
              <>
                <div
                  className="mesh-stat-row orbital-ops-debug-divider"
                  title={`Walker model scaled to McDowell total_working (${TOPOLOGY_FLEET_TARGET.toLocaleString()})`}
                >
                  <span>modeled nodes</span>
                  <b className={topologyDebug.modeledNodes === topologyDebug.fleetTarget ? 'text-bbg-cyan' : 'text-bbg-amber'}>
                    {topologyDebug.modeledNodes.toLocaleString()}/{topologyDebug.fleetTarget.toLocaleString()}
                  </b>
                </div>
                <div className="mesh-stat-row">
                  <span>generated edges</span>
                  <b>{topologyDebug.generatedEdges.toLocaleString()}</b>
                </div>
                <div className="mesh-stat-row">
                  <span>drawn edges</span>
                  <b className={topologyDebug.drawnEdges < topologyDebug.generatedEdges ? 'text-bbg-amber' : 'text-bbg-cyan'}>
                    {topologyDebug.drawnEdges.toLocaleString()}/{topologyDebug.generatedEdges.toLocaleString()}
                  </b>
                </div>
                <div className="mesh-stat-row">
                  <span>ring / cross</span>
                  <b>
                    {topologyDebug.drawnRingEdges.toLocaleString()}/{topologyDebug.generatedRingEdges.toLocaleString()}
                    {' · '}
                    {topologyDebug.drawnCrossEdges.toLocaleString()}/{topologyDebug.generatedCrossEdges.toLocaleString()}
                  </b>
                </div>
              </>
            )}
            {meshMode === 'live' && liveCatalog && (
              <div className="mesh-stat-row">
                <span>TLE source</span>
                <b className="text-bbg-cyan">{liveCatalog.tleSource}</b>
              </div>
            )}
            {meshMode === 'live' && liveLoading && (
              <div className="mesh-stat-row">
                <span>TLE</span>
                <b className="text-bbg-muted">loading…</b>
              </div>
            )}
            {meshMode === 'live' && liveError && (
              <div className="mesh-stat-row">
                <span>TLE</span>
                <b className="text-bbg-red">offline</b>
              </div>
            )}
            {meshMode === 'topology' && liveCatalogUnavailable && (
              <div className="mesh-stat-row" title="Live CelesTrak TLE feed is unreachable — showing the synthetic Walker constellation model.">
                <span>live feed</span>
                <b className="text-bbg-amber">offline · model</b>
              </div>
            )}
            {meshMode === 'topology' && activeDeployment && (
              <div className="mesh-stat-row">
                <span>filtered</span>
                <b className="text-bbg-amber">{activeHighlightCount}</b>
              </div>
            )}
            <div className="mesh-stat-row">
              <span>{meshMode === 'live' ? 'time' : 'sim rate'}</span>
              <b>{speedLabel}</b>
            </div>
            {starlinkIntel && (
              <div className="mesh-stat-row">
                <span>raising</span>
                <b className="text-bbg-amber">{starlinkIntel.lifecycle.raising}</b>
              </div>
            )}
          </div>

          <div className="mesh-overlay orbital-ops-fleet">
            <StarlinkFleetPanel
              intel={starlinkIntel}
              isLoading={intelLoading}
              liveCatalog={liveCatalog}
              meshMode={meshMode}
            />
          </div>

          <div className="mesh-overlay orbital-ops-satellite">
            <StarlinkSatellitePanel
              catalog={liveCatalog}
              selectedNoradId={selectedNoradId}
              launchOptions={launchOptions}
              onSelect={(noradId) => {
                setSelectedNoradId(noradId);
                if (noradId != null) {
                  setSelectedTopologyIndex(null);
                  if (meshMode !== 'live') selectMeshMode('live');
                }
              }}
              onClearTopology={() => setSelectedTopologyIndex(null)}
              meshMode={meshMode}
              topologyIndex={selectedTopologyIndex}
            />
          </div>
        </aside>

        <div className="mesh-overlay orbital-ops-dock hidden md:flex">
          <div className="orbital-ops-dock-section">
            <span className="orbital-ops-dock-label">catalog</span>
            <div className="mesh-toggles mb-0">
              <button
                type="button"
                className={`mesh-toggle ${meshMode === 'topology' ? 'mesh-toggle-on' : ''}`}
                onClick={() => selectMeshMode('topology')}
              >
                topology
              </button>
              <button
                type="button"
                className={`mesh-toggle ${meshMode === 'live' ? 'mesh-toggle-on' : ''}`}
                onClick={() => selectMeshMode('live')}
                title={
                  liveCatalogUnavailable
                    ? 'Live CelesTrak catalog currently unavailable'
                    : undefined
                }
              >
                live catalog
              </button>
            </div>
            <div className="mesh-toggles mesh-toggles--wrap mb-0 mt-1.5">
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
          </div>

          {meshMode === 'topology' && (
          <div className="orbital-ops-dock-section orbital-ops-dock-section--deploy">
            <span className="orbital-ops-dock-label">deployment filter</span>
            <select
              className="mesh-deploy-select w-full bg-[#0a0a12] border border-bbg-border-subtle/60 text-bbg-white text-[10px] px-2 py-1.5 rounded-sm font-mono tracking-wide"
              value={deploymentKey ?? ''}
              onChange={(e) => setDeploymentKey(e.target.value || null)}
            >
              <option value="">All satellites</option>
              {launchOptions.map((opt) => (
                <option key={opt.launch.id} value={opt.launch.id}>
                  {opt.launch.name} · {opt.spec.count} sats
                </option>
              ))}
            </select>
            <p className="orbital-ops-dock-hint">
              {activeDeployment
                ? `${activeHighlightCount} sats glow amber on the mesh`
                : 'isolate a Falcon 9 Starlink batch'}
            </p>
          </div>
          )}

          <div className="orbital-ops-dock-section orbital-ops-dock-section--sliders">
            <div className="mesh-control-label">
              {meshMode === 'live' ? (
                <>
                  orbit time <b>{speedLabel}</b>
                </>
              ) : (
                <>
                  orbital speed <b>{speedMul}×</b>
                </>
              )}
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

          <div className="orbital-ops-dock-section orbital-ops-dock-section--shells">
            <StarlinkShellFilter
              visibleShells={visibleShells}
              onToggle={toggleShell}
              onToggleAll={toggleAllShells}
              shellCounts={shellCounts}
              totalCount={nodeCount}
              meshMode={meshMode}
            />
          </div>

          <div className="orbital-ops-dock-section orbital-ops-dock-section--earth">
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
        </div>

        <div className="mesh-overlay orbital-ops-stats orbital-ops-stats-mobile md:hidden">
          <div className="mesh-stat-row">
            <span>{meshMode === 'live' ? 'tracked' : 'nodes'}</span>
            <b>{nodeCount.toLocaleString()}</b>
          </div>
          {visibleShells.size < shellSlotCount && (
            <div className="mesh-stat-row">
              <span>shells</span>
              <b className="text-bbg-cyan">{visibleShells.size} active</b>
            </div>
          )}
          {meshMode === 'topology' && (
            <div className="mesh-stat-row">
              <span>links</span>
              <b>{linkCount.toLocaleString()}</b>
            </div>
          )}
          {meshMode === 'live' && (
            <div className="mesh-stat-row">
              <span>links</span>
              <b>0</b>
            </div>
          )}
          {meshMode === 'topology' && topologyDebug && (
            <>
              <div className="mesh-stat-row">
                <span>drawn</span>
                <b className={topologyDebug.drawnEdges < topologyDebug.generatedEdges ? 'text-bbg-amber' : 'text-bbg-cyan'}>
                  {topologyDebug.drawnEdges.toLocaleString()}/{topologyDebug.generatedEdges.toLocaleString()}
                </b>
              </div>
              <div className="mesh-stat-row">
                <span>ring/cross</span>
                <b className="text-[9px]">
                  {topologyDebug.drawnRingEdges.toLocaleString()}/{topologyDebug.generatedRingEdges.toLocaleString()}
                  {' · '}
                  {topologyDebug.drawnCrossEdges.toLocaleString()}/{topologyDebug.generatedCrossEdges.toLocaleString()}
                </b>
              </div>
            </>
          )}
          {meshMode === 'topology' && activeDeployment && (
            <div className="mesh-stat-row">
              <span>filtered</span>
              <b className="text-bbg-amber">{activeHighlightCount}</b>
            </div>
          )}
          {starlinkIntel && (
            <div className="mesh-stat-row">
              <span>tracked</span>
              <b>{starlinkIntel.totalTracked.toLocaleString()}</b>
            </div>
          )}
          {meshMode === 'topology' && (
          <select
            className="mesh-deploy-select w-full mt-2 bg-[#0a0a12] border border-bbg-border-subtle/60 text-bbg-white text-[9px] px-2 py-1 rounded-sm font-mono"
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
          )}
          <div className="mt-2 pointer-events-auto">
            <StarlinkShellFilter
              visibleShells={visibleShells}
              onToggle={toggleShell}
              onToggleAll={toggleAllShells}
              shellCounts={shellCounts}
              totalCount={nodeCount}
              meshMode={meshMode}
            />
          </div>
        </div>
      </div>

      {hover &&
        !(
          (hover.mode === 'live' && hover.noradId === selectedNoradId) ||
          (hover.mode === 'topology' && hover.index === selectedTopologyIndex)
        ) && (
        <div
          className="mesh-tooltip"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 210),
            top: Math.min(hover.y + 16, window.innerHeight - 90),
          }}
        >
          {hover.mode === 'live' ? (
            <>
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
                  <div className="text-bbg-amber text-[10px] mt-1 leading-relaxed">
                    ◈ {dep.launch.name}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="text-bbg-white text-[11px] font-semibold tracking-wide">
                SAT-{String(hover.index).padStart(4, '0')}
              </div>
              <div className="text-bbg-muted text-[10px] mt-1 leading-relaxed">
                shell {hover.shellName} · plane {String(hover.plane).padStart(2, '0')} · slot{' '}
                {String(hover.slot).padStart(2, '0')}
              </div>
              {(() => {
                const dep = deploymentForSatelliteIndex(hover.index, launchOptions);
                if (!dep) return null;
                return (
                  <div className="text-bbg-amber text-[10px] mt-1 leading-relaxed">
                    ◈ {dep.launch.name}
                  </div>
                );
              })()}
              <div className="text-bbg-cyan text-[10px] mt-1">◈ {hover.linkCount} active links</div>
            </>
          )}
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
