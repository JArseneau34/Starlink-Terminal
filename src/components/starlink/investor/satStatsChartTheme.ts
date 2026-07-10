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

export const CHART_PALETTE = [
  '#3de8ff',
  '#ffc24b',
  '#2ee86a',
  '#a78bfa',
  '#ff4d5a',
  '#7a7a90',
] as const;

export const FLEET_CHART_PALETTE = [
  '#10b981',
  '#3de8ff',
  '#ffc24b',
  '#2ee86a',
  '#ff4d5a',
  '#7a7a90',
] as const;

export const GLOBAL_CHART_PALETTE = [
  '#0f52ba',
  '#60a5fa',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#7a7a90',
] as const;

export const CHART_THEME = {
  color: '#7a7a90',
  font: {
    family: '"IBM Plex Mono", ui-monospace, monospace',
    size: 9,
  },
};

export function baseChartOptions(overrides?: Record<string, unknown>) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index' as const, axis: 'x' as const, intersect: false },
    plugins: {
      legend: {
        labels: { color: '#7a7a90', boxWidth: 10, font: { size: 9 } },
      },
      tooltip: {
        backgroundColor: 'rgba(2,2,3,0.92)',
        borderColor: '#14141c',
        borderWidth: 1,
        titleColor: '#ececf4',
        bodyColor: '#7a7a90',
        titleFont: { size: 10 },
        bodyFont: { size: 9 },
      },
      zoom: {
        pan: { enabled: true, mode: 'x' as const },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          drag: { enabled: true },
          mode: 'x' as const,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#4a4a5c', maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 8 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: '#14141c' },
      },
      y: {
        ticks: { color: '#4a4a5c', font: { size: 8 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: '#14141c' },
      },
    },
    ...overrides,
  };
}

export function datasetStyle(index: number, type: 'line' | 'bar' = 'line', palette: readonly string[] = CHART_PALETTE) {
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
