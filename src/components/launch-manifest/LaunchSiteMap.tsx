import { useMemo, useState, type ReactNode } from 'react';
import type { LaunchSite } from '../../types/launchManifest';

interface LaunchSiteMapProps {
  sites: LaunchSite[];
  isLoading?: boolean;
}

const MAP_W = 720;
const MAP_H = 360;
const WORLD_MAP_SRC = '/maps/world-day.jpg';

function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

function fmtNet(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }) + ' UTC';
}

function activityColor(site: LaunchSite): string {
  if (site.upcoming.length > 0) return 'var(--color-bbg-amber)';
  if (site.recent.length > 0) return 'var(--color-bbg-cyan)';
  return 'var(--color-bbg-muted)';
}

function Graticule() {
  const lines: ReactNode[] = [];

  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * MAP_H;
    lines.push(
      <line
        key={`lat-${lat}`}
        x1={0}
        y1={y}
        x2={MAP_W}
        y2={y}
        className="launch-site-graticule"
      />
    );
  }

  for (let lon = -150; lon <= 150; lon += 30) {
    const x = ((lon + 180) / 360) * MAP_W;
    lines.push(
      <line
        key={`lon-${lon}`}
        x1={x}
        y1={0}
        x2={x}
        y2={MAP_H}
        className="launch-site-graticule"
      />
    );
  }

  return <g aria-hidden>{lines}</g>;
}

export function LaunchSiteMap({ sites, isLoading }: LaunchSiteMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapSrc, setMapSrc] = useState(WORLD_MAP_SRC);

  const selected = useMemo(
    () => sites.find((s) => s.id === selectedId) ?? sites[0] ?? null,
    [sites, selectedId]
  );

  const markers = useMemo(() => {
    const out: Array<{ site: LaunchSite; pad: { id: string; name: string }; x: number; y: number }> = [];
    for (const site of sites) {
      if (site.pads.length > 0) {
        for (const pad of site.pads) {
          out.push({ site, pad, ...project(pad.latitude, pad.longitude) });
        }
      } else {
        out.push({
          site,
          pad: { id: site.id, name: site.name },
          ...project(site.latitude, site.longitude),
        });
      }
    }
    return out;
  }, [sites]);

  if (isLoading && sites.length === 0) {
    return (
      <div className="launch-site-map p-4 text-bbg-gray text-center text-[11px]">
        Loading launch sites…
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="launch-site-map p-4 text-bbg-gray text-center text-[11px]">
        Launch site data unavailable
      </div>
    );
  }

  return (
    <div className="launch-site-map flex min-h-0 h-full">
      <div className="launch-site-map-canvas flex-1 min-w-0 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="launch-site-map-svg w-full h-full"
          role="img"
          aria-label="World map of active launch pads"
        >
          <defs>
            <clipPath id="launch-map-clip">
              <rect width={MAP_W} height={MAP_H} rx="2" />
            </clipPath>
            <filter id="launch-map-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g clipPath="url(#launch-map-clip)">
            <rect width={MAP_W} height={MAP_H} className="launch-site-map-ocean" />

            {mapSrc && (
              <image
                href={mapSrc}
                x={0}
                y={0}
                width={MAP_W}
                height={MAP_H}
                preserveAspectRatio="none"
                className="launch-site-map-earth"
                onError={() => setMapSrc('')}
              />
            )}

            <rect width={MAP_W} height={MAP_H} className="launch-site-map-tint" />
            <Graticule />

            {/* Equator & prime meridian */}
            <line
              x1={0}
              y1={MAP_H / 2}
              x2={MAP_W}
              y2={MAP_H / 2}
              className="launch-site-equator"
            />
            <line
              x1={MAP_W / 2}
              y1={0}
              x2={MAP_W / 2}
              y2={MAP_H}
              className="launch-site-prime-meridian"
            />
          </g>

          {markers.map(({ site, pad, x, y }) => {
            const active = selected?.id === site.id;
            const hasUpcoming = site.upcoming.length > 0;
            const r = hasUpcoming ? 4.5 : site.recent.length > 0 ? 3.5 : 2.5;
            const color = activityColor(site);
            return (
              <g
                key={pad.id}
                className="launch-pad-marker"
                onClick={() => setSelectedId(site.id)}
                style={{ cursor: 'pointer' }}
                filter={active ? 'url(#launch-map-glow)' : undefined}
              >
                {active && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 6}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.25"
                    opacity={0.55}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={r + 1.5}
                  fill={color}
                  opacity={active ? 0.28 : 0.16}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  stroke="rgba(8,8,14,0.85)"
                  strokeWidth="0.75"
                  opacity={active ? 1 : 0.88}
                />
                <title>
                  {pad.name} · {site.name}
                  {site.upcoming.length ? ` · ${site.upcoming.length} upcoming` : ''}
                </title>
              </g>
            );
          })}
        </svg>
        <div className="launch-site-map-legend flex gap-4 px-1 pt-1 text-[9px] text-bbg-muted">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-bbg-amber mr-1" />
            Upcoming
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-bbg-cyan mr-1" />
            Recent only
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-bbg-muted mr-1" />
            Active pad
          </span>
          <span className="ml-auto">{sites.length} sites · {markers.length} pads</span>
        </div>
      </div>

      {selected && (
        <aside className="launch-site-detail w-[240px] shrink-0 border-l border-bbg-border-subtle flex flex-col min-h-0">
          <div className="p-2 border-b border-bbg-border-subtle">
            <div className="text-[10px] text-bbg-white font-medium leading-tight">{selected.name}</div>
            <div className="text-[9px] text-bbg-muted mt-0.5">
              {selected.countryName} ({selected.countryCode}) · {selected.activePadCount} pad
              {selected.activePadCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-3 text-[9px]">
            <section>
              <div className="text-bbg-amber font-medium tracking-wider mb-1">
                UPCOMING ({selected.upcoming.length})
              </div>
              {selected.upcoming.length === 0 ? (
                <div className="text-bbg-muted">No scheduled launches</div>
              ) : (
                <ul className="space-y-1.5">
                  {selected.upcoming.slice(0, 6).map((a) => (
                    <li key={a.id} className="launch-site-activity">
                      <div className="text-bbg-white truncate">{a.name}</div>
                      <div className="text-bbg-muted">
                        {a.vehicle} · {a.padName}
                      </div>
                      <div className="text-bbg-cyan tabular-nums">{fmtNet(a.net)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <div className="text-bbg-cyan font-medium tracking-wider mb-1">
                RECENT ({selected.recent.length})
              </div>
              {selected.recent.length === 0 ? (
                <div className="text-bbg-muted">No recent launches in feed</div>
              ) : (
                <ul className="space-y-1.5">
                  {selected.recent.slice(0, 5).map((a) => (
                    <li key={a.id} className="launch-site-activity">
                      <div className="text-bbg-white truncate">{a.name}</div>
                      <div className="text-bbg-muted">
                        {a.vehicle} · {a.status}
                      </div>
                      <div className="text-bbg-gray tabular-nums">{fmtNet(a.net)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <div className="text-bbg-muted font-medium tracking-wider mb-1">PADS</div>
              <ul className="space-y-0.5 text-bbg-gray">
                {selected.pads.map((p) => (
                  <li key={p.id} className="truncate">
                    {p.name}
                    {p.totalLaunchCount > 0 && (
                      <span className="text-bbg-muted"> · {p.totalLaunchCount} launches</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
