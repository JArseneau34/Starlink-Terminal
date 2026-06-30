import { useMemo } from 'react';
import { STARLINK_FLEET_GROWTH_SERIES } from '../../data/starlinkFleetGrowthSeries';

const SATS_COLOR = '#ffc24b';
const TBPS_COLOR = '#3de8ff';

const VIEW_W = 260;
const VIEW_H = 96;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 16;

interface Scaled {
  x: number;
  satY: number;
  bwY: number;
  point: (typeof STARLINK_FLEET_GROWTH_SERIES)[number];
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export function StarlinkFleetGrowthChart() {
  const series = STARLINK_FLEET_GROWTH_SERIES;

  const model = useMemo(() => {
    if (series.length < 2) return null;

    const satMax = niceMax(Math.max(...series.map((d) => d.activeSatellites)));
    const bwMax = niceMax(Math.max(...series.map((d) => d.totalBandwidthTbps)));
    const plotW = VIEW_W - PAD_L - PAD_R;
    const plotH = VIEW_H - PAD_T - PAD_B;
    const stepX = plotW / (series.length - 1);

    const scaled: Scaled[] = series.map((point, i) => ({
      x: PAD_L + i * stepX,
      satY: PAD_T + plotH * (1 - point.activeSatellites / satMax),
      bwY: PAD_T + plotH * (1 - point.totalBandwidthTbps / bwMax),
      point,
    }));

    const satLine = scaled.map((p) => `${p.x.toFixed(1)},${p.satY.toFixed(1)}`).join(' ');
    const bwLine = scaled.map((p) => `${p.x.toFixed(1)},${p.bwY.toFixed(1)}`).join(' ');
    const baseY = PAD_T + plotH;
    const satArea = `${PAD_L.toFixed(1)},${baseY.toFixed(1)} ${satLine} ${(PAD_L + plotW).toFixed(1)},${baseY.toFixed(1)}`;

    return { scaled, satLine, bwLine, satArea, satMax, bwMax };
  }, [series]);

  const latest = series[series.length - 1];
  const first = series[0];

  if (!model || !latest || !first) {
    return (
      <div className="mesh-overlay-label">Fleet Growth · unavailable</div>
    );
  }

  const satGrowth = first.activeSatellites > 0
    ? ((latest.activeSatellites / first.activeSatellites - 1) * 100)
    : 0;
  const bwGrowth = first.totalBandwidthTbps > 0
    ? ((latest.totalBandwidthTbps / first.totalBandwidthTbps - 1) * 100)
    : 0;

  return (
    <div className="starlink-growth">
      <div className="starlink-growth-legend">
        <span className="starlink-growth-legend-item">
          <i className="starlink-growth-dot" style={{ background: SATS_COLOR }} />
          working sats
          <b className="tabular-nums" style={{ color: SATS_COLOR }}>
            {latest.activeSatellites.toLocaleString()}
          </b>
        </span>
        <span className="starlink-growth-legend-item">
          <i className="starlink-growth-dot" style={{ background: TBPS_COLOR }} />
          Tbps in orbit
          <b className="tabular-nums" style={{ color: TBPS_COLOR }}>
            {latest.totalBandwidthTbps.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </b>
        </span>
      </div>

      <svg
        className="starlink-growth-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Starlink working satellites and bandwidth over time"
      >
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD_T + (VIEW_H - PAD_T - PAD_B) * f;
          return (
            <line
              key={f}
              x1={PAD_L}
              x2={VIEW_W - PAD_R}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
          );
        })}

        <polyline points={model.satArea} fill="rgba(255,194,75,0.07)" stroke="none" />
        <polyline
          points={model.satLine}
          fill="none"
          stroke={SATS_COLOR}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={model.bwLine}
          fill="none"
          stroke={TBPS_COLOR}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {(() => {
          const last = model.scaled[model.scaled.length - 1]!;
          return (
            <>
              <circle cx={last.x} cy={last.satY} r="1.8" fill={SATS_COLOR} />
              <circle cx={last.x} cy={last.bwY} r="1.8" fill={TBPS_COLOR} />
            </>
          );
        })()}
      </svg>

      <div className="starlink-growth-axis">
        <span>{formatMonth(first.monthEnd)}</span>
        <span>{formatMonth(latest.monthEnd)}</span>
      </div>

      <div className="starlink-growth-foot">
        <span>
          sats <b style={{ color: SATS_COLOR }}>+{satGrowth.toFixed(0)}%</b>
        </span>
        <span>
          bandwidth <b style={{ color: TBPS_COLOR }}>+{bwGrowth.toFixed(0)}%</b>
        </span>
        <span className="starlink-growth-foot-span">since {formatMonth(first.monthEnd)}</span>
      </div>
    </div>
  );
}
