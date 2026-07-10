import { useMemo, type ReactNode } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { GlobalCatalogFeeds, GlobalCatalogSatKind } from '../../../types/globalCatalog';
import { baseChartOptions, datasetStyle, GLOBAL_CHART_PALETTE } from './satStatsChartTheme';

const GLOBAL_SEGMENT_SERIES = [
  { key: 'communications', label: 'Communications', color: '#0f52ba' },
  { key: 'earth_observation', label: 'Earth Observation', color: '#22c55e' },
  { key: 'navigation', label: 'Navigation', color: '#60a5fa' },
  { key: 'military', label: 'Military / Intelligence', color: '#ef4444' },
  { key: 'human_spaceflight', label: 'Human Spaceflight', color: '#f59e0b' },
  { key: 'science', label: 'Science', color: '#14b8a6' },
  { key: 'technology', label: 'Technology Demo', color: '#eab308' },
  { key: 'other', label: 'Other / Unknown', color: '#6b7280' },
] as const;

const GLOBAL_KIND_SERIES = [
  { key: 'debris', label: 'Debris', color: '#ef4444' },
  { key: 'rocket_stage', label: 'Rocket Stages', color: '#f59e0b' },
  { key: 'component', label: 'Components / Capsules', color: '#60a5fa' },
  { key: 'payload', label: 'Payloads', color: '#0f52ba' },
  { key: 'other', label: 'Other / Unknown', color: '#6b7280' },
] as const;

interface GlobalCatalogChartsGridProps {
  feeds: GlobalCatalogFeeds | null;
  satKind: GlobalCatalogSatKind;
  snapshotId?: number;
  resetToken: number;
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="starlink-inv-block sat-stats-chart-card">
      <div className="mesh-overlay-label">{title}</div>
      <div className="sat-stats-chart-wrap">{children}</div>
    </div>
  );
}

export function GlobalCatalogChartsGrid({
  feeds,
  satKind,
  snapshotId,
  resetToken,
}: GlobalCatalogChartsGridProps) {
  const isPayloads = satKind === 'payloads';

  const launches = useMemo(() => {
    const rows = feeds?.launches_per_year ?? [];
    return {
      labels: rows.map((r) => String(r.year ?? '')),
      datasets: [
        { label: 'Orbital', key: 'orbital' },
        { label: 'Successful', key: 'successful' },
        { label: 'Total (incl. suborbital)', key: 'total' },
      ].map((d, i) => ({
        label: d.label,
        data: rows.map((r) => Number(r[d.key]) || 0),
        ...datasetStyle(i, 'bar', GLOBAL_CHART_PALETTE),
      })),
    };
  }, [feeds?.launches_per_year]);

  const satellites = useMemo(() => {
    const rows = feeds?.satellites_per_year ?? [];
    return {
      labels: rows.map((r) => String(r.year ?? '')),
      datasets: [
        { label: 'Launched', key: 'launched' },
        { label: 'Still Active', key: 'still_active' },
      ].map((d, i) => ({
        label: d.label,
        data: rows.map((r) => Number(r[d.key]) || 0),
        ...datasetStyle(i, 'bar', GLOBAL_CHART_PALETTE),
      })),
    };
  }, [feeds?.satellites_per_year]);

  const operators = useMemo(() => {
    const rows = feeds?.top_operators ?? [];
    return {
      labels: rows.map((r) => String(r.agency ?? '')),
      datasets: [
        {
          label: 'Orbital Launches',
          data: rows.map((r) => Number(r.launches) || 0),
          ...datasetStyle(0, 'bar', GLOBAL_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.top_operators]);

  const states = useMemo(() => {
    const rows = feeds?.satellites_by_state ?? [];
    return {
      labels: rows.map((r) => String(r.state ?? '')),
      datasets: [
        {
          label: 'Satellites',
          data: rows.map((r) => Number(r.satellites) || 0),
          ...datasetStyle(1, 'bar', GLOBAL_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.satellites_by_state]);

  const segment = useMemo(() => {
    const rows = isPayloads
      ? (feeds?.satellites_by_segment_per_year ?? [])
      : (feeds?.satellites_by_kind_per_year ?? []);
    const series = isPayloads ? GLOBAL_SEGMENT_SERIES : GLOBAL_KIND_SERIES;
    return {
      title: isPayloads ? 'Satellites by Segment (Over Time)' : 'Objects by Kind (Over Time)',
      labels: rows.map((r) => String(r.year ?? '')),
      datasets: series.map((s) => ({
        label: s.label,
        data: rows.map((r) => Number(r[s.key]) || 0),
        backgroundColor: `${s.color}99`,
        borderColor: s.color,
        borderWidth: 1,
        stack: 'segments',
      })),
    };
  }, [feeds?.satellites_by_kind_per_year, feeds?.satellites_by_segment_per_year, isPayloads]);

  const mass = useMemo(() => {
    const rows = feeds?.mass_to_orbit_per_year ?? [];
    return {
      labels: rows.map((r) => String(r.year ?? '')),
      datasets: [
        {
          label: 'Mass to Orbit (kg)',
          data: rows.map((r) => Number(r.mass_kg) || 0),
          ...datasetStyle(2, 'line', GLOBAL_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.mass_to_orbit_per_year]);

  if (!feeds) {
    return (
      <div className="starlink-inv-block sat-stats-charts-empty">
        <div className="mesh-overlay-label">Chart feeds</div>
        <p className="starlink-inv-block-desc">Bootstrap GCAT or run Update Global to load chart feeds.</p>
      </div>
    );
  }

  const hBarOptions = baseChartOptions({ indexAxis: 'y' as const });
  const stackedBarOptions = baseChartOptions({
    scales: {
      x: { ...baseChartOptions().scales?.x, stacked: true },
      y: { ...baseChartOptions().scales?.y, stacked: true, beginAtZero: true },
    },
    plugins: {
      ...baseChartOptions().plugins,
      legend: { position: 'bottom' as const, labels: { color: '#7a7a90', boxWidth: 10, font: { size: 8 } } },
    },
  });

  const zoomKey = `${snapshotId ?? 'none'}-${resetToken}-${satKind}`;

  return (
    <div className="sat-stats-charts-grid">
      <ChartCard title="Launches per Year">
        <Bar key={`gl-${zoomKey}`} data={launches} options={baseChartOptions()} />
      </ChartCard>
      <ChartCard title="Satellites per Year">
        <Bar key={`gs-${zoomKey}`} data={satellites} options={baseChartOptions()} />
      </ChartCard>
      <ChartCard title="Top 10 Operators (Orbital Launches)">
        <Bar key={`go-${zoomKey}`} data={operators} options={hBarOptions} />
      </ChartCard>
      <ChartCard title="Satellites by State">
        <Bar key={`gst-${zoomKey}`} data={states} options={hBarOptions} />
      </ChartCard>
      <ChartCard title={segment.title}>
        <Bar key={`gseg-${zoomKey}`} data={segment} options={stackedBarOptions} />
      </ChartCard>
      <ChartCard title="Mass to Orbit per Year (kg)">
        <Line key={`gm-${zoomKey}`} data={mass} options={baseChartOptions()} />
      </ChartCard>
    </div>
  );
}
