import { format, parseISO } from 'date-fns';
import type { AltitudeBand, ConjunctionAlert, ReentryForecast } from '../../types/orbital';

interface SsaPanelProps {
  conjunctions: ConjunctionAlert[];
  densityBands: AltitudeBand[];
  reentries: ReentryForecast[];
  debrisCount: number;
  otherCount: number;
  isLoading: boolean;
}

function fmtTime(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d HH:mm') + ' UTC';
  } catch {
    return iso;
  }
}

function rangeColor(km: number): string {
  if (km < 1) return '#ff4d5a';
  if (km < 5) return '#ffc24b';
  return '#a78bfa';
}

function confidenceColor(level: ReentryForecast['confidence']): string {
  if (level === 'high') return '#ff4d5a';
  if (level === 'medium') return '#ffc24b';
  return '#7a7a90';
}

export function SsaPanel({
  conjunctions,
  densityBands,
  reentries,
  debrisCount,
  otherCount,
  isLoading,
}: SsaPanelProps) {
  const maxBand = Math.max(1, ...densityBands.map((b) => b.count));

  return (
    <div className="mesh-side-panel ssa-panel">
      <div className="mesh-overlay-label">Debris / SSA Layer</div>
      <div className="text-[9px] text-bbg-muted tracking-wider mb-3">
        conjunction screen · altitude density · reentry window
      </div>

      {isLoading && !conjunctions.length ? (
        <div className="text-bbg-muted text-[10px] py-2">Loading CelesTrak SSA…</div>
      ) : (
        <>
          <div className="mesh-stat-row mb-1">
            <span>debris nodes</span>
            <b className="text-bbg-red">{debrisCount.toLocaleString()}</b>
          </div>
          <div className="mesh-stat-row mb-2">
            <span>other SSA objects</span>
            <b className="text-bbg-red">{otherCount.toLocaleString()}</b>
          </div>

          <div className="ssa-section">
            <div className="ssa-section-title">Conjunction Alerts</div>
            {conjunctions.length === 0 ? (
              <div className="text-bbg-muted text-[10px]">No close approaches in screen window.</div>
            ) : (
              <div className="ssa-list">
                {conjunctions.slice(0, 6).map((c) => (
                  <div key={c.id} className="ssa-row">
                    <div className="ssa-row-head">
                      <span className="ssa-range" style={{ color: rangeColor(c.minRangeKm) }}>
                        {c.minRangeKm.toFixed(2)} km
                      </span>
                      <span className="ssa-prob">P≈{(c.probability * 100).toFixed(2)}%</span>
                    </div>
                    <div className="ssa-row-body">
                      {c.primaryName.trim()} · {c.secondaryName.trim()}
                    </div>
                    <div className="ssa-row-meta">
                      TCA {fmtTime(c.tca)} · Δv {c.relativeSpeedKms} km/s
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ssa-section">
            <div className="ssa-section-title">Altitude-Band Density</div>
            <div className="ssa-density-chart">
              {densityBands.map((band) => (
                <div key={band.label} className="ssa-density-row">
                  <span className="ssa-density-label">{band.label}</span>
                  <div className="ssa-density-track">
                    <div
                      className="ssa-density-fill"
                      style={{
                        width: `${(band.count / maxBand) * 100}%`,
                        opacity: 0.35 + band.densityIndex * 0.65,
                      }}
                    />
                  </div>
                  <span className="ssa-density-count">{band.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ssa-section">
            <div className="ssa-section-title">Reentry Forecasts</div>
            {reentries.length === 0 ? (
              <div className="text-bbg-muted text-[10px]">No imminent decay objects in feed.</div>
            ) : (
              <div className="ssa-list">
                {reentries.slice(0, 5).map((r) => (
                  <div key={r.noradId} className="ssa-row">
                    <div className="ssa-row-head">
                      <span className="ssa-reentry-name">{r.name.trim()}</span>
                      <span
                        className="ssa-confidence"
                        style={{ color: confidenceColor(r.confidence) }}
                      >
                        {r.confidence.toUpperCase()}
                      </span>
                    </div>
                    <div className="ssa-row-meta">
                      {fmtTime(r.windowStart)} → {fmtTime(r.windowEnd)}
                    </div>
                    <div className="ssa-row-meta">
                      {r.latitude.toFixed(1)}°, {r.longitude.toFixed(1)}° · perigee {r.perigeeKm} km
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
