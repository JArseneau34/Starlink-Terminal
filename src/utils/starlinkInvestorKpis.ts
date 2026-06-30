import { STARLINK_BANDWIDTH_SERIES } from '../data/starlinkBandwidthSeries';
import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';
import { STARLINK_LAUNCH_ARCHIVE } from '../data/starlinkLaunchArchive';
import type { StarlinkIntelPayload } from '../types/orbital';

export type InvestorKpiBadge = 'live' | 'reported' | 'estimate';

export interface InvestorKpiItem {
  key: string;
  label: string;
  value: string;
  sub: string;
  badge: InvestorKpiBadge;
  badgeLabel: string;
  title?: string;
}

export interface InvestorKpiSnapshot {
  asOfDate: string;
  items: InvestorKpiItem[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function ttmWindow(asOf = new Date()): { startExclusive: string; endInclusive: string } {
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { startExclusive: isoDate(start), endInclusive: isoDate(end) };
}

function computeTtmLaunchMetrics(asOf = new Date()) {
  const { startExclusive, endInclusive } = ttmWindow(asOf);
  let launches = 0;
  let satellites = 0;

  for (const entry of STARLINK_LAUNCH_ARCHIVE) {
    if (entry.dateUtc > startExclusive && entry.dateUtc <= endInclusive) {
      launches++;
      satellites += entry.numberOfStarlinkSatellites;
    }
  }

  return { launches, satellites, startExclusive, endInclusive };
}

function computeCapacityGrowthYoY() {
  const series = STARLINK_BANDWIDTH_SERIES;
  if (series.length === 0) return null;

  const latest = series[series.length - 1]!;
  const [year, month, day] = latest.monthEnd.split('-');
  const priorYearMonth = `${Number(year) - 1}-${month}-${day}`;
  const prior = series.find((row) => row.monthEnd === priorYearMonth);

  if (!prior || prior.totalBandwidthTbps <= 0) return null;

  const growthPct = ((latest.totalBandwidthTbps / prior.totalBandwidthTbps) - 1) * 100;
  return {
    growthPct,
    latestMonth: latest.monthEnd,
    priorMonth: prior.monthEnd,
    latestTbps: latest.totalBandwidthTbps,
    priorTbps: prior.totalBandwidthTbps,
  };
}

export function buildInvestorKpiSnapshot(
  intel: StarlinkIntelPayload | null,
  asOf = new Date()
): InvestorKpiSnapshot {
  const auth = intel?.authoritative;
  const activeSats = auth?.totalWorking ?? STARLINK_FLEET_SNAPSHOT.totalWorking;
  const bandwidthTbps = auth?.bandwidthTbps ?? STARLINK_FLEET_SNAPSHOT.totalBandwidthInOrbitTbps;
  const snapshotDate = auth?.snapshotDate ?? STARLINK_FLEET_SNAPSHOT.snapshotDate;

  const ttm = computeTtmLaunchMetrics(asOf);
  const growth = computeCapacityGrowthYoY();

  const items: InvestorKpiItem[] = [
    {
      key: 'active-sats',
      label: 'Active Satellites',
      value: activeSats.toLocaleString(),
      sub: `McDowell working fleet · ${formatSnapshotDate(snapshotDate)}`,
      badge: intel ? 'live' : 'reported',
      badgeLabel: intel ? 'live' : 'reported',
      title: 'Satellites SpaceX reports as operationally working (Jonathan McDowell catalog).',
    },
    {
      key: 'total-bandwidth',
      label: 'Total Bandwidth',
      value: `${bandwidthTbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} Tbps`,
      sub: 'Aggregate downlink capacity in orbit',
      badge: 'reported',
      badgeLabel: 'reported',
      title: 'Modeled aggregate constellation bandwidth from the pipeline assumption matrix.',
    },
    {
      key: 'launches-ttm',
      label: 'Launches TTM',
      value: ttm.launches.toLocaleString(),
      sub: `Starlink missions · ${formatSnapshotDate(ttm.startExclusive)} – ${formatSnapshotDate(ttm.endInclusive)}`,
      badge: 'reported',
      badgeLabel: 'reported',
      title: 'Falcon 9 Starlink launch missions in the trailing twelve months (Mach33 launch archive).',
    },
    {
      key: 'sats-deployed-ttm',
      label: 'Sats Deployed TTM',
      value: ttm.satellites.toLocaleString(),
      sub: 'Payload spacecraft on TTM missions',
      badge: 'reported',
      badgeLabel: 'reported',
      title: 'Starlink spacecraft deployed on missions in the trailing twelve months.',
    },
    {
      key: 'capacity-growth',
      label: 'Est. Capacity Growth',
      value: growth ? `+${growth.growthPct.toFixed(1)}%` : '—',
      sub: growth
        ? `YoY · ${formatSnapshotDate(growth.priorMonth)} → ${formatSnapshotDate(growth.latestMonth)}`
        : 'Insufficient bandwidth history',
      badge: 'estimate',
      badgeLabel: 'estimate',
      title: growth
        ? `Year-over-year change in modeled constellation bandwidth (${growth.priorTbps.toFixed(1)} → ${growth.latestTbps.toFixed(1)} Tbps).`
        : undefined,
    },
  ];

  return { asOfDate: isoDate(asOf), items };
}
