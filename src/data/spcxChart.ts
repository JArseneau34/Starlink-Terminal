import type { OhlcBar } from './spcxStats';
import { buildSpcxOhlcBars } from './spcxStats';
import type { StockQuote } from '../types';

export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W';

export interface ChartIntervalOption {
  id: ChartInterval;
  label: string;
  ms: number;
  group: 'minutes' | 'hours' | 'days';
}

export const CHART_INTERVALS: ChartIntervalOption[] = [
  { id: '1m', label: '1m', ms: 60_000, group: 'minutes' },
  { id: '5m', label: '5m', ms: 5 * 60_000, group: 'minutes' },
  { id: '15m', label: '15m', ms: 15 * 60_000, group: 'minutes' },
  { id: '30m', label: '30m', ms: 30 * 60_000, group: 'minutes' },
  { id: '1H', label: '1H', ms: 60 * 60_000, group: 'hours' },
  { id: '4H', label: '4H', ms: 4 * 60 * 60_000, group: 'hours' },
  { id: '1D', label: '1D', ms: 24 * 60 * 60_000, group: 'days' },
  { id: '1W', label: '1W', ms: 7 * 24 * 60 * 60_000, group: 'days' },
];

/** Regular session length used for intraday synthesis (6h 30m). */
const SESSION_MS = 6.5 * 60 * 60 * 1000;

/** Max candles rendered per interval (keeps SVG responsive). */
const MAX_BARS: Record<ChartInterval, number> = {
  '1m': 390,
  '5m': 390,
  '15m': 260,
  '30m': 180,
  '1H': 120,
  '4H': 80,
  '1D': 60,
  '1W': 26,
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sessionOpenMs(dateStr: string): number {
  // 9:30 AM US/Eastern ≈ 13:30 UTC during EDT (matches app IPO era)
  return new Date(`${dateStr}T13:30:00.000Z`).getTime();
}

function formatBarLabel(timestamp: number, interval: ChartInterval): string {
  const d = new Date(timestamp);
  if (interval === '1W') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (interval === '1D') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (interval === '4H' || interval === '1H') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}

function formatTooltipTime(timestamp: number, interval: ChartInterval): string {
  const d = new Date(timestamp);
  if (interval === '1D' || interval === '1W') {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function synthesizeIntraday(daily: OhlcBar, intervalMs: number, interval: ChartInterval): OhlcBar[] {
  const count = Math.max(1, Math.floor(SESSION_MS / intervalMs));
  const rng = mulberry32(hashSeed(`${daily.date}:${intervalMs}`));
  const dayOpen = sessionOpenMs(daily.date);

  const path: number[] = [daily.open];
  const drift = (daily.close - daily.open) / count;

  for (let i = 1; i < count; i++) {
    const noise = (rng() - 0.5) * (daily.high - daily.low) * 0.22;
    let next = path[i - 1]! + drift + noise;
    next = Math.max(daily.low, Math.min(daily.high, next));
    path.push(next);
  }
  path.push(daily.close);

  const bars: OhlcBar[] = [];
  for (let i = 0; i < count; i++) {
    const open = path[i]!;
    const close = path[i + 1]!;
    const wick = (daily.high - daily.low) * (0.04 + rng() * 0.1);
    const high = Math.min(daily.high, Math.max(open, close) + wick);
    const low = Math.max(daily.low, Math.min(open, close) - wick);
    const timestamp = dayOpen + i * intervalMs;

    bars.push({
      timestamp,
      date: new Date(timestamp).toISOString(),
      label: formatBarLabel(timestamp, interval),
      open,
      high,
      low,
      close,
      volume: daily.volume ? Math.round((daily.volume / count) * (0.65 + rng() * 0.7)) : undefined,
    });
  }

  return bars;
}

function withTimestamps(dailies: OhlcBar[]): OhlcBar[] {
  return dailies.map((bar) => ({
    ...bar,
    timestamp: bar.timestamp ?? sessionOpenMs(bar.date),
    label: bar.label,
  }));
}

function aggregateWeekly(dailies: OhlcBar[]): OhlcBar[] {
  if (dailies.length === 0) return [];

  const weeks: OhlcBar[] = [];
  let bucket: OhlcBar[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0]!;
    const last = bucket[bucket.length - 1]!;
    const timestamp = first.timestamp ?? sessionOpenMs(first.date);
    weeks.push({
      timestamp,
      date: first.date,
      label: `Wk ${weeks.length + 1}`,
      open: first.open,
      high: Math.max(...bucket.map((b) => b.high)),
      low: Math.min(...bucket.map((b) => b.low)),
      close: last.close,
      volume: bucket.reduce((s, b) => s + (b.volume ?? 0), 0),
    });
    bucket = [];
  };

  for (const bar of dailies) {
    bucket.push(bar);
    if (bucket.length >= 5) flush();
  }
  flush();

  return weeks;
}

function tailBars(bars: OhlcBar[], interval: ChartInterval): OhlcBar[] {
  const max = MAX_BARS[interval];
  if (bars.length <= max) return bars;
  return bars.slice(-max);
}

export function buildSpcxChartBars(
  interval: ChartInterval,
  quote?: Pick<StockQuote, 'price' | 'open' | 'high' | 'low' | 'volume'>
): OhlcBar[] {
  const dailies = withTimestamps(buildSpcxOhlcBars(quote));
  const option = CHART_INTERVALS.find((i) => i.id === interval)!;

  if (interval === '1D') {
    return tailBars(
      dailies.map((bar) => ({
        ...bar,
        label: formatBarLabel(bar.timestamp!, '1D'),
      })),
      interval
    );
  }

  if (interval === '1W') {
    return tailBars(aggregateWeekly(dailies), interval);
  }

  let bars: OhlcBar[] = [];
  for (const day of dailies) {
    bars.push(...synthesizeIntraday(day, option.ms, interval));
  }

  // Patch forming bar on the latest session with live quote
  if (quote?.price && bars.length > 0) {
    const last = bars[bars.length - 1]!;
    last.open = quote.open > 0 ? quote.open : last.open;
    last.high = Math.max(last.high, quote.high, quote.price);
    last.low = Math.min(last.low, quote.low, quote.price);
    last.close = quote.price;
    if (quote.volume > 0) last.volume = quote.volume;
  }

  return tailBars(bars, interval);
}

export function chartIntervalLabel(interval: ChartInterval): string {
  return CHART_INTERVALS.find((i) => i.id === interval)?.label ?? interval;
}

export { formatTooltipTime };
