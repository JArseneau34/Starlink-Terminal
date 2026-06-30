import { useMemo } from 'react';
import {
  buildLaunchProductivity,
  formatQuarter,
  type LaunchProductivityQuarter,
} from '../../utils/starlinkLaunchProductivity';

const SATS_COLOR = '#a78bfa';
const GBPS_COLOR = '#2ee86a';

const VIEW_W = 260;
const VIEW_H = 96;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 16;

interface Scaled {
  x: number;
  satY: number;
  gbpsY: number;
  point: LaunchProductivityQuarter;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function StarlinkLaunchProductivityChart() {
  const snapshot = useMemo(() => buildLaunchProductivity(), []);
  const { quarters, first, latest, satsDeltaPct, gbpsDeltaPct } = snapshot;

  const model = useMemo(() => {
    if (quarters.length < 2) return null;

    const satMax = niceMax(Math.max(...quarters.map((d) => d.satsPerLaunch)));
    const gbpsMax = niceMax(Math.max(...quarters.map((d) => d.gbpsPerLaunch)));
    const plotW = VIEW_W - PAD_L - PAD_R;
    const plotH = VIEW_H - PAD_T - PAD_B;
    const stepX = plotW / (quarters.length - 1);

    const scaled: Scaled[] = quarters.map((point, i) => ({
      x: PAD_L + i * stepX,
      satY: PAD_T + plotH * (1 - point.satsPerLaunch / satMax),
      gbpsY: PAD_T + plotH * (1 - point.gbpsPerLaunch / gbpsMax),
      point,
    }));

    const satLine = scaled.map((p) => `${p.x.toFixed(1)},${p.satY.toFixed(1)}`).join(' ');
    const gbpsLine = scaled.map((p) => `${p.x.toFixed(1)},${p.gbpsY.toFixed(1)}`).join(' ');
    const baseY = PAD_T + plotH;
    const gbpsArea = `${PAD_L.toFixed(1)},${baseY.toFixed(1)} ${gbpsLine} ${(PAD_L + plotW).toFixed(1)},${baseY.toFixed(1)}`;

    return { scaled, satLine, gbpsLine, gbpsArea };
  }, [quarters]);

  if (!model || !first || !latest) {
    return <div className="mesh-overlay-label">Launch Productivity · unavailable</div>;
  }

  return (
    <div className="starlink-growth">
      <div className="starlink-growth-legend">
        <span className="starlink-growth-legend-item">
          <i className="starlink-growth-dot" style={{ background: SATS_COLOR }} />
          sats / launch
          <b className="tabular-nums" style={{ color: SATS_COLOR }}>
            {latest.satsPerLaunch.toFixed(0)}
          </b>
        </span>
        <span className="starlink-growth-legend-item">
          <i className="starlink-growth-dot" style={{ background: GBPS_COLOR }} />
          Gbps / launch
          <b className="tabular-nums" style={{ color: GBPS_COLOR }}>
            {latest.gbpsPerLaunch.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </b>
        </span>
      </div>

      <svg
        className="starlink-growth-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Starlink satellites and bandwidth added per launch over time"
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

        <polyline points={model.gbpsArea} fill="rgba(46,232,106,0.07)" stroke="none" />
        <polyline
          points={model.gbpsLine}
          fill="none"
          stroke={GBPS_COLOR}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={model.satLine}
          fill="none"
          stroke={SATS_COLOR}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {(() => {
          const last = model.scaled[model.scaled.length - 1]!;
          return (
            <>
              <circle cx={last.x} cy={last.gbpsY} r="1.8" fill={GBPS_COLOR} />
              <circle cx={last.x} cy={last.satY} r="1.8" fill={SATS_COLOR} />
            </>
          );
        })()}
      </svg>

      <div className="starlink-growth-axis">
        <span>{formatQuarter(first.quarter)}</span>
        <span>{formatQuarter(latest.quarter)}</span>
      </div>

      <div className="starlink-growth-foot">
        <span>
          sats/launch{' '}
          <b style={{ color: SATS_COLOR }}>
            {satsDeltaPct >= 0 ? '+' : ''}
            {satsDeltaPct.toFixed(0)}%
          </b>
        </span>
        <span>
          capacity/launch{' '}
          <b style={{ color: GBPS_COLOR }}>
            {gbpsDeltaPct >= 0 ? '+' : ''}
            {gbpsDeltaPct.toFixed(0)}%
          </b>
        </span>
        <span className="starlink-growth-foot-span">since {formatQuarter(first.quarter)}</span>
      </div>
    </div>
  );
}
