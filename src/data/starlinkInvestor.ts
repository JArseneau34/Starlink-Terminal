import type { Launch } from '../types';
import type { StarlinkIntelPayload } from '../types/orbital';
import { STARLINK_SHELLS, shellSatCount } from '../components/starlink/starlinkCatalog';
import { filterSpaceXLaunches } from './spcxStats';

export type MetricSource = 'live' | 'reported' | 'estimate';

export interface StarlinkBusinessKpi {
  label: string;
  value: string;
  sub?: string;
  source: MetricSource;
  asOf?: string;
}

export interface CompetitorRow {
  operator: string;
  fleetTracked: number | null;
  /** Static NORAD / public baseline when live feed unavailable */
  fleetBaseline: number | null;
  targetFleet: string;
  lastLaunch: string;
  note: string;
}

export interface StarlinkMilestone {
  date: string;
  event: string;
  detail: string;
}

/** Reported business metrics — update on earnings / press cycles. */
export const STARLINK_BUSINESS_KPIS: StarlinkBusinessKpi[] = [
  {
    label: 'SUBSCRIBERS',
    value: '6.2M+',
    sub: 'Residential · maritime · aviation · enterprise',
    source: 'reported',
    asOf: '2026-Q1',
  },
  {
    label: 'MARKETS LIVE',
    value: '100+',
    sub: 'Countries & territories with consumer service',
    source: 'reported',
    asOf: '2026-Q1',
  },
  {
    label: 'DIRECT-TO-CELL',
    value: '12',
    sub: 'Countries with D2C beta / partner rollout',
    source: 'reported',
    asOf: '2026-04',
  },
  {
    label: 'REVENUE RUN-RATE',
    value: '~$8B',
    sub: 'Industry estimate · not SpaceX reported',
    source: 'estimate',
    asOf: '2026',
  },
];

export const STARLINK_INVESTOR_MILESTONES: StarlinkMilestone[] = [
  {
    date: '2026-04-18',
    event: 'Direct-to-cell expansion',
    detail: 'D2C service live in 12 countries via partner MNOs',
  },
  {
    date: '2026-03-01',
    event: 'Gen2 shell deployment',
    detail: 'V2 Mini batches filling 53° shells at accelerated cadence',
  },
  {
    date: '2025-12-15',
    event: 'Maritime & aviation',
    detail: 'Enterprise segment growth in cruise, airline, and oil & gas',
  },
  {
    date: '2025-09-01',
    event: 'Starshield contracts',
    detail: 'US gov / allied defense connectivity programs',
  },
];

/** Static competitor baselines — Starlink fleet updated from live NORAD. */
export const LEO_BROADBAND_COMPETITORS: Omit<CompetitorRow, 'fleetTracked'>[] = [
  {
    operator: 'Starlink',
    fleetBaseline: null,
    targetFleet: '12,000+ authorized',
    lastLaunch: '—',
    note: 'Live NORAD catalog · SpaceX ephemerides',
  },
  {
    operator: 'Project Kuiper',
    fleetBaseline: 48,
    targetFleet: '3,236 authorized',
    lastLaunch: 'Jan 2026',
    note: 'Prototype batches · New Glenn',
  },
  {
    operator: 'OneWeb',
    fleetBaseline: 634,
    targetFleet: '648 Gen1',
    lastLaunch: 'Mar 2023',
    note: 'Eutelsat · enterprise + gov',
  },
  {
    operator: 'Telesat Lightspeed',
    fleetBaseline: 0,
    targetFleet: '198 planned',
    lastLaunch: '—',
    note: 'Financing · not yet at scale',
  },
];

export function formatAgeHours(hours: number): string {
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function kpRiskLevel(kp: number | null | undefined): {
  label: string;
  tone: 'quiet' | 'elevated' | 'storm';
} {
  if (kp == null || !Number.isFinite(kp)) return { label: 'No data', tone: 'quiet' };
  if (kp >= 5) return { label: 'Storm · drag risk', tone: 'storm' };
  if (kp >= 4) return { label: 'Elevated', tone: 'elevated' };
  return { label: 'Quiet', tone: 'quiet' };
}

export function isStarlinkLaunch(launch: Launch): boolean {
  return /starlink/i.test(launch.name);
}

export function starlinkLaunchesFrom(launches: Launch[]): Launch[] {
  return filterSpaceXLaunches(launches).filter(isStarlinkLaunch);
}

export function shellFillStats(intel: StarlinkIntelPayload) {
  return intel.shells.map((sh) => {
    const topology = STARLINK_SHELLS.find((s) => s.name === sh.name);
    const plannedNodes = topology ? shellSatCount(topology) : null;
    return {
      ...sh,
      fleetSharePct: Math.round((sh.count / intel.totalTracked) * 1000) / 10,
      operationalPct: sh.count > 0 ? Math.round((sh.operational / sh.count) * 1000) / 10 : 0,
      topologyModelNodes: plannedNodes,
    };
  });
}

export function launchCadenceMetrics(launches: Launch[]) {
  const starlink = starlinkLaunchesFrom(launches);
  const now = Date.now();
  const year = new Date().getUTCFullYear();
  const ytd = starlink.filter((l) => new Date(l.date).getUTCFullYear() === year).length;

  const sorted = [...starlink].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastLaunch = sorted[0] ?? null;
  const daysSinceLast = lastLaunch
    ? Math.floor((now - new Date(lastLaunch.date).getTime()) / 86_400_000)
    : null;

  const last90 = starlink.filter(
    (l) => now - new Date(l.date).getTime() <= 90 * 86_400_000
  ).length;

  const spacexTotal = filterSpaceXLaunches(launches);
  const spacexYtd = spacexTotal.filter((l) => new Date(l.date).getUTCFullYear() === year).length;
  const starlinkShareYtd =
    spacexYtd > 0 ? Math.round((ytd / spacexYtd) * 1000) / 10 : null;

  let avgDaysBetween: number | null = null;
  if (sorted.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(sorted.length - 1, 12); i++) {
      const a = new Date(sorted[i]!.date).getTime();
      const b = new Date(sorted[i + 1]!.date).getTime();
      gaps.push((a - b) / 86_400_000);
    }
    avgDaysBetween = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  const upcoming = starlink
    .filter((l) => new Date(l.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return {
    ytd,
    last90,
    daysSinceLast,
    lastLaunch,
    avgDaysBetween,
    starlinkShareYtd,
    spacexYtd,
    upcoming,
    totalListed: starlink.length,
  };
}

export function operationalProxies(intel: StarlinkIntelPayload) {
  const total = intel.totalTracked || 1;
  const operationalPct = Math.round((intel.lifecycle.operational / total) * 1000) / 10;
  const raisingPct = Math.round((intel.lifecycle.raising / total) * 1000) / 10;
  const ephemGap = intel.totalTracked - intel.ephemerisPublished;
  const commissioningProxy = ephemGap > 0 ? ephemGap : 0;

  return {
    operationalPct,
    raisingPct,
    commissioningProxy,
    ephemerisCoveragePct: Math.round((intel.ephemerisPublished / total) * 1000) / 10,
  };
}

export function sourceBadge(source: MetricSource): string {
  if (source === 'live') return 'LIVE';
  if (source === 'reported') return 'REPORTED';
  return 'EST.';
}

export function sourceBadgeClass(source: MetricSource): string {
  if (source === 'live') return 'starlink-inv-badge--live';
  if (source === 'reported') return 'starlink-inv-badge--reported';
  return 'starlink-inv-badge--estimate';
}
