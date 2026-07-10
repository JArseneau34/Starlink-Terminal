import { useMemo, type ReactNode } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { SatStatsSnapshot } from '../../../types/satStats';
import { baseChartOptions, datasetStyle, trimLeadingRows, FLEET_CHART_PALETTE } from './satStatsChartTheme';

interface SatStatsChartsGridProps {
  snapshot: SatStatsSnapshot | null;
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

export function SatStatsChartsGrid({ snapshot, resetToken }: SatStatsChartsGridProps) {
  const feeds = snapshot?.feeds;

  const launches = useMemo(() => {
    const rows = trimLeadingRows(feeds?.launches_by_vehicle ?? [], [
      'falcon_9',
      'falcon_heavy',
      'dragon_crew',
      'dragon_cargo',
      'starship',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        { label: 'Falcon 9', key: 'falcon_9' },
        { label: 'Falcon Heavy', key: 'falcon_heavy' },
        { label: 'Dragon Crew', key: 'dragon_crew' },
        { label: 'Dragon Cargo', key: 'dragon_cargo' },
        { label: 'Starship', key: 'starship' },
      ].map((d, i) => ({
        label: d.label,
        data: rows.map((r) => Number(r[d.key]) || 0),
        ...datasetStyle(i, 'bar', FLEET_CHART_PALETTE),
      })),
    };
  }, [feeds?.launches_by_vehicle]);

  const bandwidth = useMemo(() => {
    const rows = trimLeadingRows(feeds?.bandwidth_vs_customers ?? [], [
      'total_bandwidth_tbps',
      'customers_imputed',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        {
          label: 'Bandwidth (Tbps)',
          data: rows.map((r) => Number(r.total_bandwidth_tbps) || 0),
          yAxisID: 'y',
          ...datasetStyle(0, 'line', FLEET_CHART_PALETTE),
        },
        {
          label: 'Customers',
          data: rows.map((r) => Number(r.customers_imputed) || 0),
          yAxisID: 'y1',
          ...datasetStyle(1, 'line', FLEET_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.bandwidth_vs_customers]);

  const active = useMemo(() => {
    const rows = trimLeadingRows(feeds?.active_vs_deorbited_sats ?? [], [
      'active_satellites',
      'deorbited_satellites',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        {
          label: 'Active',
          data: rows.map((r) => Number(r.active_satellites) || 0),
          ...datasetStyle(0, 'line', FLEET_CHART_PALETTE),
        },
        {
          label: 'Deorbited',
          data: rows.map((r) => Number(r.deorbited_satellites) || 0),
          ...datasetStyle(4, 'line', FLEET_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.active_vs_deorbited_sats]);

  const density = useMemo(() => {
    const rows = trimLeadingRows(feeds?.bandwidth_density_vs_satlaunch ?? [], [
      'gbps_per_kg',
      'satellites_per_launch',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        {
          label: 'Gbps/kg',
          data: rows.map((r) => Number(r.gbps_per_kg) || 0),
          ...datasetStyle(2, 'line', FLEET_CHART_PALETTE),
        },
        {
          label: 'Sats / launch',
          data: rows.map((r) => Number(r.satellites_per_launch) || 0),
          ...datasetStyle(3, 'line', FLEET_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.bandwidth_density_vs_satlaunch]);

  const models = useMemo(() => {
    const rows = trimLeadingRows(feeds?.sat_model_segmentation ?? [], [
      'v1',
      'v15',
      'v2_mini',
      'v2_mini_d2c',
      'v2_mini_opt',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        { label: 'V1', key: 'v1' },
        { label: 'V1.5', key: 'v15' },
        { label: 'V2 Mini', key: 'v2_mini' },
        { label: 'V2 DTC', key: 'v2_mini_d2c' },
        { label: 'V2 Opt', key: 'v2_mini_opt' },
      ].map((d, i) => ({
        label: d.label,
        data: rows.map((r) => Number(r[d.key]) || 0),
        ...datasetStyle(i, 'line', FLEET_CHART_PALETTE),
      })),
    };
  }, [feeds?.sat_model_segmentation]);

  const share = useMemo(() => {
    const rows = trimLeadingRows(feeds?.starlink_vs_customer_share ?? [], [
      't3m_starlink_pct',
      't3m_customer_pct',
    ]);
    return {
      labels: rows.map((r) => String(r.month_end ?? '')),
      datasets: [
        {
          label: 'T3M Starlink %',
          data: rows.map((r) => (Number(r.t3m_starlink_pct) || 0) * 100),
          ...datasetStyle(0, 'line', FLEET_CHART_PALETTE),
        },
        {
          label: 'T3M Customer %',
          data: rows.map((r) => (Number(r.t3m_customer_pct) || 0) * 100),
          ...datasetStyle(1, 'line', FLEET_CHART_PALETTE),
        },
      ],
    };
  }, [feeds?.starlink_vs_customer_share]);

  if (!snapshot) {
    return (
      <div className="starlink-inv-block sat-stats-charts-empty">
        <div className="mesh-overlay-label">Chart feeds</div>
        <p className="starlink-inv-block-desc">Run Update to load computed chart feeds.</p>
      </div>
    );
  }

  const bwOptions = baseChartOptions({
    scales: {
      x: baseChartOptions().scales?.x,
      y: { ...baseChartOptions().scales?.y, position: 'left' },
      y1: {
        position: 'right',
        ticks: { color: '#4a4a5c', font: { size: 8 } },
        grid: { drawOnChartArea: false },
        border: { color: '#14141c' },
      },
    },
  });

  const barOptions = baseChartOptions({
    scales: {
      x: { ...baseChartOptions().scales?.x, stacked: true },
      y: { ...baseChartOptions().scales?.y, stacked: true },
    },
  });

  const zoomKey = `${snapshot.snapshot_id}-${resetToken}`;

  return (
    <div className="sat-stats-charts-grid">
      <ChartCard title="Launches by vehicle">
        <Bar key={`launches-${zoomKey}`} data={launches} options={barOptions} />
      </ChartCard>
      <ChartCard title="Bandwidth vs customers">
        <Line key={`bw-${zoomKey}`} data={bandwidth} options={bwOptions} />
      </ChartCard>
      <ChartCard title="Active vs deorbited">
        <Line key={`active-${zoomKey}`} data={active} options={baseChartOptions()} />
      </ChartCard>
      <ChartCard title="Bandwidth density vs sats/launch">
        <Line key={`density-${zoomKey}`} data={density} options={baseChartOptions()} />
      </ChartCard>
      <ChartCard title="Satellite model segmentation">
        <Line key={`model-${zoomKey}`} data={models} options={baseChartOptions()} />
      </ChartCard>
      <ChartCard title="Starlink vs customer share (T3M)">
        <Line key={`share-${zoomKey}`} data={share} options={baseChartOptions()} />
      </ChartCard>
    </div>
  );
}
