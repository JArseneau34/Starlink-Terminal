import type { AuroraOval, KpReading, SolarFlareEvent, SolarWindReading } from '../../types/orbital';

interface SpaceWeatherPanelProps {
  kp: KpReading | null;
  kpHistory: KpReading[];
  solarWind: SolarWindReading | null;
  aurora: AuroraOval | null;
  flares: SolarFlareEvent[];
}

function kpColor(kp: number): string {
  if (kp >= 7) return '#ff4d5a';
  if (kp >= 5) return '#ffc24b';
  if (kp >= 4) return '#a78bfa';
  return '#3de8ff';
}

function kpLabel(kp: number): string {
  if (kp >= 7) return 'STORM';
  if (kp >= 5) return 'ACTIVE';
  if (kp >= 4) return 'UNSETTLED';
  return 'QUIET';
}

export function SpaceWeatherPanel({
  kp,
  kpHistory,
  solarWind,
  aurora,
  flares,
}: SpaceWeatherPanelProps) {
  const kpVal = kp?.kp ?? 0;
  const kpPct = Math.min(100, (kpVal / 9) * 100);

  return (
    <div className="mesh-side-panel mesh-side-panel-right">
      <div className="mesh-overlay-label">Space Weather · NOAA SWPC</div>

      <div className="mt-1 mb-3">
        <div className="flex items-end justify-between gap-2 mb-1">
          <span className="text-[9px] text-bbg-muted tracking-wider uppercase">Kp Index</span>
          <span className="text-[10px] font-semibold" style={{ color: kpColor(kpVal) }}>
            {kpLabel(kpVal)}
          </span>
        </div>
        <div className="mesh-kp-track">
          <div
            className="mesh-kp-fill"
            style={{ width: `${kpPct}%`, background: kpColor(kpVal) }}
          />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums mt-1">
          <span className="text-bbg-muted">0</span>
          <span className="text-bbg-white font-semibold">{kpVal.toFixed(1)}</span>
          <span className="text-bbg-muted">9</span>
        </div>
        {kpHistory.length > 1 && (
          <div className="flex items-end gap-px h-6 mt-2">
            {kpHistory.map((h) => (
              <div
                key={h.time}
                className="flex-1 rounded-sm min-w-0"
                style={{
                  height: `${Math.max(12, (h.kp / 9) * 100)}%`,
                  background: kpColor(h.kp),
                  opacity: 0.75,
                }}
                title={`Kp ${h.kp} · ${h.time}`}
              />
            ))}
          </div>
        )}
      </div>

      {solarWind && (
        <>
          <div className="mesh-stat-row">
            <span>solar wind</span>
            <b>{Math.round(solarWind.speedKms)} km/s</b>
          </div>
          <div className="mesh-stat-row">
            <span>density</span>
            <b>{solarWind.density.toFixed(1)} p/cm³</b>
          </div>
        </>
      )}

      {aurora && (
        <div className="mt-2">
          <div className="mesh-overlay-label">Aurora Oval</div>
          <div className="mesh-aurora-map mt-1">
            <svg viewBox="0 0 120 60" className="w-full h-14" aria-hidden>
              <ellipse cx="60" cy="30" rx="54" ry="26" fill="none" stroke="rgba(167,139,250,0.25)" strokeWidth="0.5" />
              {aurora.north.length > 2 && (
                <polyline
                  fill="none"
                  stroke="#3de8ff"
                  strokeWidth="1.2"
                  opacity="0.85"
                  points={aurora.north
                    .filter((_, i) => i % 4 === 0)
                    .map((p) => `${((p.lon + 180) / 360) * 120},${30 - (p.lat / 90) * 24}`)
                    .join(' ')}
                />
              )}
              {aurora.south.length > 2 && (
                <polyline
                  fill="none"
                  stroke="#ff6bd6"
                  strokeWidth="1.2"
                  opacity="0.75"
                  points={aurora.south
                    .filter((_, i) => i % 4 === 0)
                    .map((p) => `${((p.lon + 180) / 360) * 120},${30 - (p.lat / 90) * 24}`)
                    .join(' ')}
                />
              )}
            </svg>
          </div>
          <div className="mesh-stat-row mt-1">
            <span>north extent</span>
            <b>{aurora.maxNorthLat.toFixed(0)}°N</b>
          </div>
          <div className="mesh-stat-row">
            <span>south extent</span>
            <b>{Math.abs(aurora.maxSouthLat).toFixed(0)}°S</b>
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="mesh-overlay-label">Recent X / M Flares</div>
        {flares.length === 0 ? (
          <div className="text-bbg-muted text-[10px] py-1">None in last 14 days</div>
        ) : (
          <ul className="space-y-1 mt-1 max-h-24 overflow-y-auto">
            {flares.map((flare) => (
              <li key={`${flare.time}-${flare.classLabel}`} className="flex justify-between gap-2 text-[10px]">
                <span
                  className={`font-semibold tabular-nums ${
                    flare.classLabel.startsWith('X') ? 'text-bbg-red' : 'text-bbg-amber'
                  }`}
                >
                  {flare.classLabel}
                </span>
                <span className="text-bbg-muted tabular-nums truncate">
                  {new Date(flare.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
