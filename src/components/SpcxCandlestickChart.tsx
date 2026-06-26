import { useMemo, useState } from 'react';
import type { OhlcBar } from '../data/spcxStats';
import type { ChartInterval } from '../data/spcxChart';
import { formatTooltipTime } from '../data/spcxChart';
import { formatVolume } from '../utils/format';

interface SpcxCandlestickChartProps {
  bars: OhlcBar[];
  interval: ChartInterval;
  height?: number;
}

interface HoverState {
  bar: OhlcBar;
  x: number;
  y: number;
}

const VIEW_W = 640;
const VIEW_H = 160;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

function barKey(bar: OhlcBar, index: number): string {
  return `${bar.timestamp ?? bar.date}-${index}`;
}

export function SpcxCandlestickChart({ bars, interval, height = 160 }: SpcxCandlestickChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const layout = useMemo(() => {
    if (bars.length === 0) return null;

    const chartW = VIEW_W - PAD.left - PAD.right;
    const chartH = VIEW_H - PAD.top - PAD.bottom;
    const min = Math.min(...bars.map((b) => b.low));
    const max = Math.max(...bars.map((b) => b.high));
    const pad = (max - min) * 0.06 || 4;
    const yMin = min - pad;
    const yMax = max + pad;
    const span = yMax - yMin || 1;

    const y = (price: number) => PAD.top + chartH * (1 - (price - yMin) / span);
    const slotW = chartW / bars.length;
    const bodyW = Math.max(1.5, Math.min(10, slotW * 0.62));

    const yTicks = [yMin, yMin + span * 0.5, yMax];
    const labelEvery = Math.max(1, Math.ceil(bars.length / 7));

    return { y, slotW, bodyW, yTicks, labelEvery };
  }, [bars]);

  if (!layout || bars.length === 0) {
    return (
      <div className="spcx-candle-chart spcx-candle-chart--empty" style={{ height }}>
        <span className="text-bbg-muted text-[10px]">No OHLC data</span>
      </div>
    );
  }

  const { y, slotW, bodyW, yTicks, labelEvery } = layout;

  const setHoverFromEvent = (bar: OhlcBar, e: React.MouseEvent<SVGGElement>) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      bar,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="spcx-candle-chart" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="spcx-candle-svg"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="spcx-candle-grid"
            />
            <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" className="spcx-candle-axis">
              ${tick.toFixed(0)}
            </text>
          </g>
        ))}

        {bars.map((bar, i) => {
          const cx = PAD.left + slotW * i + slotW / 2;
          const isUp = bar.close >= bar.open;
          const bodyTop = y(Math.max(bar.open, bar.close));
          const bodyBottom = y(Math.min(bar.open, bar.close));
          const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
          const wickTop = y(bar.high);
          const wickBottom = y(bar.low);
          const showLabel = i % labelEvery === 0 || i === bars.length - 1;

          return (
            <g
              key={barKey(bar, i)}
              className="spcx-candle-group"
              onMouseEnter={(e) => setHoverFromEvent(bar, e)}
              onMouseMove={(e) => setHoverFromEvent(bar, e)}
            >
              <rect
                x={PAD.left + slotW * i}
                y={PAD.top}
                width={slotW}
                height={VIEW_H - PAD.top - PAD.bottom}
                fill="transparent"
              />
              <line
                x1={cx}
                x2={cx}
                y1={wickTop}
                y2={wickBottom}
                className={isUp ? 'spcx-candle-wick-up' : 'spcx-candle-wick-down'}
              />
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyHeight}
                className={isUp ? 'spcx-candle-body-up' : 'spcx-candle-body-down'}
                rx={0.5}
              />
              {showLabel && (
                <text
                  x={cx}
                  y={VIEW_H - 8}
                  textAnchor="middle"
                  className="spcx-candle-axis spcx-candle-label"
                >
                  {bar.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="spcx-candle-tooltip"
          style={{ left: hover.x + 12, top: hover.y - 8 }}
        >
          <div className="spcx-candle-tooltip-date">
            {formatTooltipTime(hover.bar.timestamp ?? Date.parse(hover.bar.date), interval)}
          </div>
          <div>
            O <span>${hover.bar.open.toFixed(2)}</span>
          </div>
          <div>
            H <span>${hover.bar.high.toFixed(2)}</span>
          </div>
          <div>
            L <span>${hover.bar.low.toFixed(2)}</span>
          </div>
          <div>
            C <span>${hover.bar.close.toFixed(2)}</span>
          </div>
          {hover.bar.volume != null && (
            <div className="spcx-candle-tooltip-vol">Vol {formatVolume(hover.bar.volume)}</div>
          )}
        </div>
      )}
    </div>
  );
}
