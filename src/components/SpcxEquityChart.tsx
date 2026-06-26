import { useMemo, useState } from 'react';
import type { StockQuote } from '../types';
import {
  CHART_INTERVALS,
  buildSpcxChartBars,
  chartIntervalLabel,
  type ChartInterval,
} from '../data/spcxChart';
import { SpcxCandlestickChart } from './SpcxCandlestickChart';

interface SpcxEquityChartProps {
  quote?: StockQuote;
}

export function SpcxEquityChart({ quote }: SpcxEquityChartProps) {
  const [interval, setInterval] = useState<ChartInterval>('5m');

  const bars = useMemo(() => buildSpcxChartBars(interval, quote), [interval, quote]);

  const minuteIntervals = CHART_INTERVALS.filter((i) => i.group === 'minutes');
  const hourIntervals = CHART_INTERVALS.filter((i) => i.group === 'hours');
  const dayIntervals = CHART_INTERVALS.filter((i) => i.group === 'days');

  return (
    <div className="spcx-equity-chart-wrap">
      <div className="spcx-chart-toolbar">
        <div className="spcx-chart-toolbar-group">
          <span className="spcx-chart-toolbar-label">Min</span>
          {minuteIntervals.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`spcx-chart-interval${interval === opt.id ? ' spcx-chart-interval--active' : ''}`}
              onClick={() => setInterval(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="spcx-chart-toolbar-group">
          <span className="spcx-chart-toolbar-label">Hr</span>
          {hourIntervals.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`spcx-chart-interval${interval === opt.id ? ' spcx-chart-interval--active' : ''}`}
              onClick={() => setInterval(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="spcx-chart-toolbar-group">
          <span className="spcx-chart-toolbar-label">Day</span>
          {dayIntervals.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`spcx-chart-interval${interval === opt.id ? ' spcx-chart-interval--active' : ''}`}
              onClick={() => setInterval(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="spcx-candle-legend">
        <span className="spcx-candle-legend-item">
          <i className="spcx-candle-legend-dot spcx-candle-legend-dot--up" />
          Up
        </span>
        <span className="spcx-candle-legend-item">
          <i className="spcx-candle-legend-dot spcx-candle-legend-dot--down" />
          Down
        </span>
        <span className="spcx-candle-legend-meta">
          {chartIntervalLabel(interval)} · {bars.length} bars · since IPO
        </span>
      </div>

      <SpcxCandlestickChart bars={bars} interval={interval} />
    </div>
  );
}
