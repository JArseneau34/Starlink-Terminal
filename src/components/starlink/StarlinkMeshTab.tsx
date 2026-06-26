import { useMemo, useState } from 'react';
import type { StarlinkMeshMode } from '../../types/orbital';
import {
  buildDefaultStarlinkLaunchOptions,
  deploymentForNoradId,
  deploymentForSatelliteIndex,
  enrichLaunchOptionsWithLiveCatalog,
  type StarlinkLaunchOption,
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
import { StarlinkMeshCanvas, type StarlinkHoverInfo } from './StarlinkMeshCanvas';
import { DEFAULT_EARTH_VISUAL, type EarthVisualOptions } from './earthGlobe';
import { SpaceWeatherPanel } from './SpaceWeatherPanel';
import { StarlinkFleetPanel } from './StarlinkFleetPanel';
import { StarlinkSatellitePanel } from './StarlinkSatellitePanel';
import { useOrbitalOpsData } from '../../hooks/useOrbitalOpsData';
import { useStarlinkCatalogData } from '../../hooks/useStarlinkCatalogData';
import { useStarlinkIntelData } from '../../hooks/useStarlinkIntelData';

function formatLaunchDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function StarlinkDeploymentFilter({
  options,
  selectedKey,
  onSelect,
  meshMode,
}: {
  options: StarlinkLaunchOption[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  meshMode: StarlinkMeshMode;
}) {
  const active = options.find((o) => o.launch.id === selectedKey) ?? null;

  return (
    <div className="mesh-overlay orbital-ops-deployments">
      <div className="mesh-overlay-label">Starlink Deployments</div>
      <select
        className="mesh-deploy-select w-full mt-1.5 mb-2 bg-[#0a0a12] border border-bbg-border-subtle/60 text-bbg-white text-[10px] px-2 py-1.5 rounded-sm font-mono tracking-wide"
        value={selectedKey ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">All satellites</option>
        {options.map((opt) => (
          <option key={opt.launch.id} value={opt.launch.id}>
            {opt.launch.name} · {opt.spec.count} sats
          </option>
        ))}
      </select>

      {active ? (
        <div className="text-[9px] leading-relaxed space-y-1.5 border-t border-bbg-border-subtle/40 pt-2">
          <div className="flex justify-between gap-2">
            <span className="text-bbg-muted">payload</span>
            <span className="text-bbg-amber tabular-nums">{active.spec.count} nodes</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-bbg-muted">shell</span>
            <span className="text-bbg-cyan">{active.shellLabel} incl.</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-bbg-muted">plane</span>
            <span className="text-bbg-white tabular-nums">{String(active.spec.plane).padStart(2, '0')}</span>
          </div>
          {active.launch.pad && (
            <div className="flex justify-between gap-2">
              <span className="text-bbg-muted">pad</span>
              <span className="text-bbg-white">{active.launch.pad}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-bbg-muted">date</span>
            <span className="text-bbg-white tabular-nums">{formatLaunchDate(active.launch.date)}</span>
          </div>
          {active.spec.note && (
            <p className="text-bbg-gray text-[8px] tracking-wide pt-1">{active.spec.note}</p>
          )}
          <p className="text-bbg-muted text-[8px] tracking-wide pt-1">
            <span className="text-bbg-amber">amber nodes</span> = this launch batch
            {meshMode === 'live' ? ' (TLE epoch match)' : ' on the mesh'}
          </p>
        </div>
      ) : (
        <p className="text-bbg-muted text-[9px] leading-relaxed">
          Filter the constellation by Falcon 9 Starlink mission. Matching satellites glow amber; the
          rest dim{meshMode === 'live' ? ' (epoch + inclination match)' : ' on the mesh'}.
        </p>
      )}
    </div>
  );
}

export function OrbitalOpsTab() {
  const { satellites, edgeA } = useMemo(() => buildStarlinkCatalog(), []);
  const [meshMode, setMeshMode] = useState<StarlinkMeshMode>('live');
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
  const { data } = useOrbitalOpsData();

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

  const toggleEarthVisual = (key: keyof EarthVisualOptions) => {
    setEarthVisual((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleShell = (shellIndex: number) => {
    setVisibleShells((prev) => {
      const next = new Set(prev);
      if (next.has(shellIndex)) {
        if (next.size <= 1) return prev;
        next.delete(shellIndex);
      } else {
        next.add(shellIndex);
      }
      return next;
    });
  };

  const shellCounts = useMemo(() => {
    if (meshMode === 'live' && liveCatalog) {
      const counts = STARLINK_SHELLS.map((_, i) => ({ shell: i, count: 0 }));
      for (const sat of liveCatalog.satellites) {
        const row = counts[sat.shell];
        if (row) row.count++;
      }
      return counts;
    }
    return STARLINK_SHELLS.map((sh, i) => ({
      shell: i,
      count: shellSatCount(sh),
    }));
  }, [meshMode, liveCatalog]);

  const visibleNodeCount = useMemo(() => {
    if (visibleShells.size >= STARLINK_SHELLS.length) {
      return meshMode === 'live' ? (liveCatalog?.count ?? 0) : satellites.length;
    }
    if (meshMode === 'live' && liveCatalog) {
      return liveCatalog.satellites.filter((s) => visibleShells.has(s.shell)).length;
    }
    return satellites.filter((s) => visibleShells.has(s.shell)).length;
  }, [visibleShells, meshMode, liveCatalog, satellites]);

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
  const sw = data?.spaceWeather;
  const nodeCount = visibleNodeCount;
  const linkCount = meshMode === 'live' ? 0 : edgeA.length;
  const activeHighlightCount =
    meshMode === 'live'
      ? (activeDeployment?.noradIds.size ?? 0)
      : (activeDeployment?.indices.size ?? 0);
  const speedLabel =
    meshMode === 'live' && speedMul <= 0 ? 'real-time' : `${speedMul}× ${meshMode === 'live' ? 'sim' : 'real'}`;
  const showLinks = meshMode === 'topology';

  return (
    <div className="orbital-ops-shell flex-1 relative min-h-0 overflow-hidden panel-surface">
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
        selectedNoradId={selectedNoradId}
        selectedTopologyIndex={selectedTopologyIndex}
        highlightedIndices={meshMode === 'topology' ? (activeDeployment?.indices ?? null) : null}
        highlightedNoradIds={meshMode === 'live' ? (activeDeployment?.noradIds ?? null) : null}
        deploymentFilterKey={deploymentKey}
        visibleShells={visibleShells}
        liveCatalog={liveCatalog}
        auroraNorth={sw?.aurora?.north}
        auroraSouth={sw?.aurora?.south}
        earthVisual={earthVisual}
      />

      <div className="orbital-ops-chrome">
        <header className="mesh-overlay orbital-ops-title">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gradient-accent">
            Starlink Orbital Ops
          </div>
          <div className="text-[9px] text-bbg-muted tracking-wider mt-1 orbital-ops-title-sub">
            live TLE · Walker topology · fleet · space weather
            {starlinkIntel ? (
              <span className="text-bbg-cyan ml-2 tabular-nums">
                · {starlinkIntel.totalTracked.toLocaleString()} NORAD
              </span>
            ) : null}
          </div>
        </header>

        <aside className="orbital-ops-left hidden md:flex">
          <div className="mesh-overlay orbital-ops-stats">
            <div className="mesh-stat-row">
              <span>mode</span>
              <b>{meshMode === 'live' ? 'live TLE' : 'topology'}</b>
            </div>
            <div className="mesh-stat-row">
              <span>nodes</span>
              <b>{nodeCount.toLocaleString()}</b>
            </div>
            {visibleShells.size < STARLINK_SHELLS.length && (
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
            {activeDeployment && (
              <div className="mesh-stat-row">
                <span>filtered</span>
                <b className="text-bbg-amber">{activeHighlightCount}</b>
              </div>
            )}
            <div className="mesh-stat-row">
              <span>{meshMode === 'live' ? 'time' : 'sim rate'}</span>
              <b>{speedLabel}</b>
            </div>
            {sw?.kp && (
              <div className="mesh-stat-row">
                <span>Kp now</span>
                <b>{sw.kp.kp.toFixed(1)}</b>
              </div>
            )}
            {starlinkIntel && (
              <div className="mesh-stat-row">
                <span>raising</span>
                <b className="text-bbg-amber">{starlinkIntel.lifecycle.raising}</b>
              </div>
            )}
          </div>

          <div className="mesh-overlay orbital-ops-fleet">
            <StarlinkFleetPanel intel={starlinkIntel} isLoading={intelLoading} />
          </div>

          <StarlinkDeploymentFilter
            options={launchOptions}
            selectedKey={deploymentKey}
            onSelect={setDeploymentKey}
            meshMode={meshMode}
          />

          <div className="mesh-overlay orbital-ops-satellite">
            <StarlinkSatellitePanel
              catalog={liveCatalog}
              selectedNoradId={selectedNoradId}
              launchOptions={launchOptions}
              onSelect={(noradId) => {
                setSelectedNoradId(noradId);
                if (noradId != null) {
                  setSelectedTopologyIndex(null);
                  if (meshMode !== 'live') setMeshMode('live');
                }
              }}
              onClearTopology={() => setSelectedTopologyIndex(null)}
              meshMode={meshMode}
              topologyIndex={selectedTopologyIndex}
            />
          </div>
        </aside>

        <aside className="orbital-ops-right hidden md:flex">
          <div className="orbital-ops-right-data">
            <div className="mesh-overlay orbital-ops-space">
              {sw ? (
                <SpaceWeatherPanel
                  kp={sw.kp}
                  kpHistory={sw.kpHistory}
                  solarWind={sw.solarWind}
                  aurora={sw.aurora}
                  flares={sw.flares}
                />
              ) : (
                <div className="mesh-side-panel">
                  <div className="mesh-overlay-label">Space Weather</div>
                  <div className="text-bbg-muted text-[10px] py-2">Loading NOAA SWPC…</div>
                </div>
              )}
            </div>
          </div>

          <div className="mesh-overlay orbital-ops-controls">
            <div className="orbital-ops-controls-section">
              <div className="mesh-toggles mb-0">
                <button
                  type="button"
                  className={`mesh-toggle ${meshMode === 'topology' ? 'mesh-toggle-on' : ''}`}
                  onClick={() => setMeshMode('topology')}
                >
                  topology
                </button>
                <button
                  type="button"
                  className={`mesh-toggle ${meshMode === 'live' ? 'mesh-toggle-on' : ''}`}
                  onClick={() => setMeshMode('live')}
                >
                  live catalog
                </button>
              </div>
            </div>

            <div className="orbital-ops-controls-section">
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
              <p className="orbital-ops-controls-hint">
                {meshMode === 'live'
                  ? '0 = real-time TLE · above = sim advance'
                  : '0 = real-time SGP4 · above = sim advance'}
              </p>

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
              <p className="orbital-ops-controls-hint">
                0 = true scale · higher = exaggerated shell separation
              </p>
            </div>

            <div className="orbital-ops-controls-section">
              <StarlinkShellFilter
                visibleShells={visibleShells}
                onToggle={toggleShell}
                shellCounts={shellCounts}
              />
            </div>

            <div className="orbital-ops-controls-section">
              <div className="mesh-control-label">earth visuals</div>
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

            <div className="orbital-ops-controls-section">
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
            </div>
          </div>
        </aside>

        <div className="mesh-overlay orbital-ops-stats orbital-ops-stats-mobile md:hidden">
          <div className="mesh-stat-row">
            <span>nodes</span>
            <b>{nodeCount.toLocaleString()}</b>
          </div>
          {visibleShells.size < STARLINK_SHELLS.length && (
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
          {activeDeployment && (
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
          <div className="mt-2 pointer-events-auto">
            <StarlinkShellFilter
              visibleShells={visibleShells}
              onToggle={toggleShell}
              shellCounts={shellCounts}
            />
          </div>
        </div>

        <div className="orbital-ops-hint hidden lg:block pointer-events-none">
          <span className="text-bbg-amber">click</span> node ·{' '}
          <span className="text-bbg-amber">amber</span> = deployment · shells = filter
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
    </div>
  );
}

/** @deprecated Use OrbitalOpsTab */
export const StarlinkMeshTab = OrbitalOpsTab;
