import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

const CHART_PALETTE_DARK = [
  '#3de8ff',
  '#ffc24b',
  '#2ee86a',
  '#a78bfa',
  '#ff4d5a',
  '#7a7a90',
] as const;

const CHART_PALETTE_LIGHT = [
  '#0891b2',
  '#b45309',
  '#059669',
  '#6d28d9',
  '#dc2626',
  '#5c5e70',
] as const;

const FLEET_CHART_PALETTE_DARK = [
  '#10b981',
  '#3de8ff',
  '#ffc24b',
  '#2ee86a',
  '#ff4d5a',
  '#7a7a90',
] as const;

const FLEET_CHART_PALETTE_LIGHT = [
  '#047857',
  '#0891b2',
  '#b45309',
  '#059669',
  '#dc2626',
  '#5c5e70',
] as const;

const GLOBAL_CHART_PALETTE_DARK = [
  '#0f52ba',
  '#60a5fa',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#7a7a90',
] as const;

const GLOBAL_CHART_PALETTE_LIGHT = [
  '#1d4ed8',
  '#2563eb',
  '#059669',
  '#b45309',
  '#dc2626',
  '#5c5e70',
] as const;

function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.theme === 'light';
}

/** Read a live CSS custom property (follows dark/light tokens). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function CHART_PALETTE(): readonly string[] {
  return isLightTheme() ? CHART_PALETTE_LIGHT : CHART_PALETTE_DARK;
}

export function FLEET_CHART_PALETTE(): readonly string[] {
  return isLightTheme() ? FLEET_CHART_PALETTE_LIGHT : FLEET_CHART_PALETTE_DARK;
}

export function GLOBAL_CHART_PALETTE(): readonly string[] {
  return isLightTheme() ? GLOBAL_CHART_PALETTE_LIGHT : GLOBAL_CHART_PALETTE_DARK;
}

export function chartColors() {
  if (isLightTheme()) {
    return {
      muted: '#5c5e70',
      tick: '#6b6d80',
      grid: 'rgba(20,20,28,0.08)',
      border: '#c8cad6',
      tooltipBg: 'rgba(255,255,255,0.96)',
      tooltipBorder: '#c8cad6',
      tooltipTitle: '#14141c',
      tooltipBody: '#5c5e70',
    };
  }
  return {
    muted: '#7a7a90',
    tick: '#4a4a5c',
    grid: 'rgba(255,255,255,0.04)',
    border: '#14141c',
    tooltipBg: 'rgba(2,2,3,0.92)',
    tooltipBorder: '#14141c',
    tooltipTitle: '#ececf4',
    tooltipBody: '#7a7a90',
  };
}

export const CHART_THEME = {
  get color() {
    return chartColors().muted;
  },
  font: {
    family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    size: 9,
  },
};

export function chartZoomPluginOptions(enabled: boolean) {
  return {
    pan: { enabled, mode: 'x' as const },
    zoom: {
      wheel: { enabled },
      pinch: { enabled },
      drag: { enabled },
      mode: 'x' as const,
    },
  };
}

export function baseChartOptions(
  overrides?: Record<string, unknown>,
  zoomEnabled = false
) {
  const c = chartColors();
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index' as const, axis: 'x' as const, intersect: false },
    plugins: {
      legend: {
        labels: { color: c.muted, boxWidth: 10, font: { size: 9 } },
      },
      tooltip: {
        backgroundColor: c.tooltipBg,
        borderColor: c.tooltipBorder,
        borderWidth: 1,
        titleColor: c.tooltipTitle,
        bodyColor: c.tooltipBody,
        titleFont: { size: 10 },
        bodyFont: { size: 9 },
      },
      zoom: chartZoomPluginOptions(zoomEnabled),
    },
    scales: {
      x: {
        ticks: { color: c.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 8 } },
        grid: { color: c.grid },
        border: { color: c.border },
      },
      y: {
        ticks: { color: c.tick, font: { size: 8 } },
        grid: { color: c.grid },
        border: { color: c.border },
      },
    },
  };
  if (!overrides) return base;

  // Deep-merge plugins so callers can tweak legend without dropping zoom.
  const o = overrides as {
    plugins?: Record<string, unknown>;
    scales?: Record<string, unknown>;
  };
  return {
    ...base,
    ...overrides,
    plugins: {
      ...base.plugins,
      ...(o.plugins ?? {}),
      zoom:
        (o.plugins?.zoom as typeof base.plugins.zoom | undefined) ??
        chartZoomPluginOptions(zoomEnabled),
    },
    scales: {
      ...base.scales,
      ...(o.scales ?? {}),
    },
  };
}

export function datasetStyle(index: number, type: 'line' | 'bar' = 'line', palette: readonly string[] = CHART_PALETTE()) {
  const color = palette[index % palette.length]!;
  if (type === 'bar') {
    return { backgroundColor: `${color}99`, borderColor: color, borderWidth: 1 };
  }
  return {
    borderColor: color,
    backgroundColor: `${color}22`,
    pointRadius: 0,
    pointHoverRadius: 3,
    borderWidth: 1.5,
    tension: 0.2,
    fill: false,
  };
}

export function trimLeadingRows(
  rows: Record<string, unknown>[],
  keys: string[]
): Record<string, unknown>[] {
  const isMeaningful = (value: unknown) => {
    if (value == null || value === '') return false;
    const n = Number(value);
    if (!Number.isNaN(n)) return n !== 0;
    return true;
  };
  let start = 0;
  while (start < rows.length) {
    if (keys.some((k) => isMeaningful(rows[start]?.[k]))) break;
    start += 1;
  }
  return rows.slice(start);
}

export function fmtMetric(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  const n = Number(value);
  if (!Number.isNaN(n)) return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
  return String(value);
}

/** Chart series point — missing stays null (gap), never coerced to 0. */
export function chartPoint(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** SVG sparkline / grid stroke that follows app color mode. */
export function chartGridStroke(): string {
  return isLightTheme() ? 'rgba(20,20,28,0.1)' : 'rgba(255,255,255,0.06)';
}
