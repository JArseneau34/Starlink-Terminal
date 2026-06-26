import { useEffect, useRef, useState } from 'react';
import type { StarlinkLaunchOption } from '../../data/starlinkDeployments';
import type { StarlinkCatalogPayload, StarlinkSatelliteDetail } from '../../types/orbital';
import {
  detailFromCatalogIndex,
  fetchSatelliteDetail,
  findCatalogIndex,
  searchSatellites,
} from '../../utils/starlinkSatellite';
import { satrecFromCatalogIndex } from '../../utils/starlinkPropagation';
import type { SatRec } from 'satellite.js';

interface StarlinkSatellitePanelProps {
  catalog: StarlinkCatalogPayload | null;
  selectedNoradId: number | null;
  launchOptions: StarlinkLaunchOption[];
  onSelect: (noradId: number | null) => void;
  onClearTopology: () => void;
  meshMode: 'topology' | 'live';
  topologyIndex?: number | null;
}

function lifecycleLabel(lifecycle: StarlinkSatelliteDetail['lifecycle']): string {
  if (lifecycle === 'operational') return 'OPERATIONAL';
  if (lifecycle === 'raising') return 'RAISING';
  if (lifecycle === 'deorbiting') return 'DECAYING';
  return 'OTHER';
}

function lifecycleColor(lifecycle: StarlinkSatelliteDetail['lifecycle']): string {
  if (lifecycle === 'operational') return '#2ee86a';
  if (lifecycle === 'raising') return '#ffc24b';
  if (lifecycle === 'deorbiting') return '#ff4d5a';
  return '#7a7a90';
}

function formatCoord(value: number, posSuffix: string, negSuffix: string): string {
  const abs = Math.abs(value).toFixed(2);
  return `${abs}°${value >= 0 ? posSuffix : negSuffix}`;
}

function TopologyDetail({
  index,
  launchOptions,
  onClear,
}: {
  index: number;
  launchOptions: StarlinkLaunchOption[];
  onClear: () => void;
}) {
  const dep = launchOptions.find((o) => o.indices.has(index));

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-bbg-white text-[11px] font-semibold tracking-wide">
          SAT-{String(index).padStart(4, '0')}
        </div>
        <button type="button" className="starlink-sat-clear" onClick={onClear}>
          clear
        </button>
      </div>
      <div className="text-bbg-muted text-[9px] mb-2">
        Walker ISL grid · SGP4 Walker elements · clock synced to live catalog
      </div>
      {dep && (
        <div className="text-bbg-amber text-[10px] mb-2 leading-relaxed">◈ {dep.launch.name}</div>
      )}
    </>
  );
}

export function StarlinkSatellitePanel({
  catalog,
  selectedNoradId,
  launchOptions,
  onSelect,
  onClearTopology,
  meshMode,
  topologyIndex = null,
}: StarlinkSatellitePanelProps) {
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<StarlinkSatelliteDetail | null>(null);
  const [searchResults, setSearchResults] = useState<StarlinkSatelliteDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const satrecRef = useRef<SatRec | null>(null);
  const catalogIndexRef = useRef(-1);

  useEffect(() => {
    if (selectedNoradId == null) {
      setDetail(null);
      satrecRef.current = null;
      catalogIndexRef.current = -1;
      return;
    }

    const idx = catalog?.satellites.findIndex((s) => s.noradId === selectedNoradId) ?? -1;
    if (catalog && idx >= 0) {
      catalogIndexRef.current = idx;
      satrecRef.current = satrecFromCatalogIndex(catalog, idx);
      setDetail(detailFromCatalogIndex(catalog, idx, new Date(), satrecRef.current));
      return;
    }

    satrecRef.current = null;
    catalogIndexRef.current = -1;
    setLoading(true);
    fetchSatelliteDetail(selectedNoradId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [catalog, selectedNoradId]);

  useEffect(() => {
    if (catalogIndexRef.current < 0 || !catalog) return;

    let frame = 0;
    const tick = () => {
      const idx = catalogIndexRef.current;
      if (idx >= 0) {
        setDetail(detailFromCatalogIndex(catalog, idx, new Date(), satrecRef.current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [catalog, selectedNoradId]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;

    if (catalog && meshMode === 'live') {
      const idx = findCatalogIndex(catalog, q);
      if (idx != null) {
        const sat = catalog.satellites[idx]!;
        onSelect(sat.noradId);
        setSearchOpen(false);
        setSearchResults([]);
        return;
      }
    }

    setLoading(true);
    try {
      const results = await searchSatellites(q);
      setSearchResults(results);
      setSearchOpen(true);
      if (results.length === 1) {
        onSelect(results[0]!.noradId);
        setSearchOpen(false);
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const showTopology = meshMode === 'topology' && topologyIndex != null;

  return (
    <div className="mesh-side-panel starlink-sat-panel">
      <div className="mesh-overlay-label">Satellite Lookup</div>
      <div className="starlink-sat-search">
        <input
          type="text"
          className="starlink-sat-input"
          placeholder="NORAD ID or STARLINK-####"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
        />
        <button type="button" className="starlink-sat-search-btn" onClick={runSearch} disabled={loading}>
          find
        </button>
      </div>
      <div className="text-bbg-muted text-[8px] tracking-wide mb-2">
        click a node on the mesh · or search by NORAD / name
      </div>

      {searchOpen && searchResults.length > 0 && (
        <ul className="starlink-sat-results mb-2">
          {searchResults.map((result) => (
            <li key={result.noradId}>
              <button
                type="button"
                className="starlink-sat-result-btn"
                onClick={() => {
                  onSelect(result.noradId);
                  setSearchOpen(false);
                  setSearchResults([]);
                  setQuery(result.name);
                }}
              >
                <span className="text-bbg-white">{result.name.trim()}</span>
                <span className="text-bbg-muted tabular-nums">NORAD {result.noradId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && !detail && !showTopology && (
        <div className="text-bbg-muted text-[10px] py-2">Loading satellite…</div>
      )}

      {showTopology && (
        <TopologyDetail
          index={topologyIndex}
          launchOptions={launchOptions}
          onClear={onClearTopology}
        />
      )}

      {!showTopology && detail && (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-bbg-white text-[11px] font-semibold tracking-wide leading-snug min-w-0 truncate">
              {detail.name.trim()}
            </div>
            <button type="button" className="starlink-sat-clear" onClick={() => onSelect(null)}>
              clear
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="starlink-sat-lifecycle"
              style={{ color: lifecycleColor(detail.lifecycle), borderColor: lifecycleColor(detail.lifecycle) }}
            >
              {lifecycleLabel(detail.lifecycle)}
            </span>
            <span className="text-bbg-muted text-[9px] tabular-nums">NORAD {detail.noradId}</span>
          </div>

          <div className="mesh-stat-row">
            <span>position</span>
            <b>
              {formatCoord(detail.latitude, 'N', 'S')}, {formatCoord(detail.longitude, 'E', 'W')}
            </b>
          </div>
          <div className="mesh-stat-row">
            <span>altitude</span>
            <b>{detail.altitudeKm} km</b>
          </div>
          <div className="mesh-stat-row">
            <span>ground speed</span>
            <b>{detail.groundSpeedKms} km/s</b>
          </div>
          <div className="mesh-stat-row">
            <span>vertical Δ</span>
            <b className={detail.verticalSpeedKms >= 0 ? 'text-bbg-cyan' : 'text-bbg-amber'}>
              {detail.verticalSpeedKms >= 0 ? '+' : ''}
              {detail.verticalSpeedKms} km/s
            </b>
          </div>
          <div className="mesh-stat-row">
            <span>shell</span>
            <b>
              {detail.shellName} · {detail.inclination}°
            </b>
          </div>
          <div className="mesh-stat-row">
            <span>perigee / apogee</span>
            <b>
              {detail.perigeeKm} / {detail.apogeeKm} km
            </b>
          </div>
          <div className="mesh-stat-row">
            <span>eccentricity</span>
            <b>{detail.eccentricity.toFixed(6)}</b>
          </div>
          {detail.objectId && (
            <div className="mesh-stat-row">
              <span>intl designator</span>
              <b className="tabular-nums">{detail.objectId}</b>
            </div>
          )}
          {detail.launchBatch && (
            <div className="mesh-stat-row">
              <span>launch batch</span>
              <b className="tabular-nums">{detail.launchBatch}</b>
            </div>
          )}
          <div className="mesh-stat-row">
            <span>TLE epoch</span>
            <b className="tabular-nums">{detail.epochAgeHours}h ago</b>
          </div>

          {(() => {
            const dep = launchOptions.find((o) => o.noradIds.has(detail.noradId));
            if (!dep) return null;
            return (
              <div className="text-bbg-amber text-[10px] mt-2 leading-relaxed border-t border-bbg-border-subtle/40 pt-2 truncate" title={dep.launch.name}>
                ◈ deployment: {dep.launch.name}
              </div>
            );
          })()}
        </>
      )}

      {!showTopology && !detail && !loading && selectedNoradId == null && (
        <div className="text-bbg-muted text-[10px] py-1">No satellite selected</div>
      )}
    </div>
  );
}
