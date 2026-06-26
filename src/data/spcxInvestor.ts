import type { Launch } from '../types';
import type { StarlinkIntelPayload } from '../types/orbital';
import { filterSpaceXLaunches } from './spcxStats';
import { isStarlinkLaunch, launchCadenceMetrics } from './starlinkInvestor';

export type SpcxMetricSource = 'live' | 'reported' | 'estimate';

export interface SpcxInvestorKpi {
  label: string;
  value: string;
  sub?: string;
  source: SpcxMetricSource;
  asOf?: string;
}

export interface SpcxRevenueSegment {
  name: string;
  sharePct: number;
  revenueEst: string;
  source: SpcxMetricSource;
  note: string;
}

export interface SpcxPeerEquity {
  symbol: string;
  name: string;
  marketCap: string;
  evRevenue: string;
  note: string;
}

export interface SpcxOpsProgram {
  program: string;
  status: string;
  metric: string;
  note: string;
}

export interface SpcxInvestorBullet {
  title: string;
  detail: string;
}

export const SPCX_REVENUE_SEGMENTS: SpcxRevenueSegment[] = [
  {
    name: 'Starlink',
    sharePct: 72,
    revenueEst: '~$5.8B',
    source: 'estimate',
    note: 'Consumer, enterprise, maritime, aviation, D2C',
  },
  {
    name: 'Launch Services',
    sharePct: 18,
    revenueEst: '~$1.4B',
    source: 'estimate',
    note: 'Falcon 9 / Heavy · NASA · commercial · DoD',
  },
  {
    name: 'Starshield / Gov',
    sharePct: 6,
    revenueEst: '~$480M',
    source: 'estimate',
    note: 'Defense connectivity · NSSL adjacent',
  },
  {
    name: 'Dragon & Other',
    sharePct: 4,
    revenueEst: '~$320M',
    source: 'estimate',
    note: 'Crew & cargo · engineering services',
  },
];

export const SPCX_EQUITY_KPIS: SpcxInvestorKpi[] = [
  {
    label: 'FY26E REVENUE',
    value: '~$8.1B',
    sub: 'Segment-weighted run-rate',
    source: 'estimate',
    asOf: '2026',
  },
  {
    label: 'STARLINK RUN-RATE',
    value: '~$8B',
    sub: 'Industry est. · broadband + enterprise',
    source: 'estimate',
    asOf: '2026',
  },
  {
    label: 'LAUNCH REV / FLIGHT',
    value: '~$67M',
    sub: 'Blended Falcon manifest ASP',
    source: 'estimate',
    asOf: '2026',
  },
  {
    label: 'GROSS MARGIN (BLENDED)',
    value: 'Mid-40s %',
    sub: 'Starlink accretive vs launch',
    source: 'estimate',
    asOf: '2026-Q1',
  },
  {
    label: 'CAPEX INTENSITY',
    value: 'High',
    sub: 'Starship + Gen2 constellation',
    source: 'reported',
    asOf: 'S-1',
  },
  {
    label: 'FREE CASH FLOW',
    value: 'Breakeven+',
    sub: 'Starlink funding launch R&D',
    source: 'estimate',
    asOf: '2026',
  },
];

export const SPCX_CAPITAL_STRUCTURE = {
  ipoProceeds: '$55.6B',
  sharesOffered: '412M',
  floatPct: '~18%',
  insiderLockup: '180 days',
  primaryUse: 'Starship development · Starlink Gen2 · working capital',
  netDebt: 'Minimal',
  creditProfile: 'Investment-grade trajectory post-IPO',
};

export const SPCX_PEER_EQUITY: SpcxPeerEquity[] = [
  {
    symbol: 'RKLB',
    name: 'Rocket Lab',
    marketCap: '$28B',
    evRevenue: '12×',
    note: 'Small launch + space systems',
  },
  {
    symbol: 'ASTS',
    name: 'AST SpaceMobile',
    marketCap: '$12B',
    evRevenue: 'N/M',
    note: 'LEO broadband · pre-revenue scale',
  },
  {
    symbol: 'IRDM',
    name: 'Iridium',
    marketCap: '$8B',
    evRevenue: '4×',
    note: 'Mature satcom · lower growth',
  },
  {
    symbol: 'LMT',
    name: 'Lockheed Martin',
    marketCap: '$118B',
    evRevenue: '1.6×',
    note: 'Defense prime · space segment',
  },
];

export const SPCX_GROWTH_DRIVERS: SpcxInvestorBullet[] = [
  {
    title: 'Starlink cash engine',
    detail: 'Subscriber growth and ARPU expansion fund Starship and Gen2 deployment without dilution.',
  },
  {
    title: 'Launch cadence moat',
    detail: 'Highest-flight-rate orbital launcher with reusable boosters and internal manifest priority.',
  },
  {
    title: 'Starship step-change',
    detail: '100t-class vehicle unlocks Gen2 sats, lunar landers, and point-to-point if operational.',
  },
  {
    title: 'Direct-to-cell TAM',
    detail: 'MNO partnerships expand addressable market beyond fixed broadband terminals.',
  },
];

export const SPCX_EQUITY_RISKS: SpcxInvestorBullet[] = [
  {
    title: 'Starship execution',
    detail: 'Development delays push out cost-per-kg improvements and Gen2 deployment pace.',
  },
  {
    title: 'LEO competition',
    detail: 'Amazon Kuiper and regional operators may compress pricing in key markets.',
  },
  {
    title: 'Regulatory & spectrum',
    detail: 'ITU/FCC coordination, debris rules, and national market access remain gating factors.',
  },
  {
    title: 'Single-company concentration',
    detail: 'SPCX equity tied to one operator across launch, broadband, and deep-space bets.',
  },
];

export const SPCX_OPS_PROGRAMS: SpcxOpsProgram[] = [
  {
    program: 'Falcon 9',
    status: 'ACTIVE',
    metric: '400+ flights',
    note: 'Primary revenue vehicle · booster reuse >20x',
  },
  {
    program: 'Starship',
    status: 'TEST',
    metric: '8 IFT flights',
    note: 'Booster catch · ship reentry · depot refuel path',
  },
  {
    program: 'Starlink Gen2',
    status: 'DEPLOYING',
    metric: 'V2 Mini batches',
    note: 'D2C capable · filling 53° shells',
  },
  {
    program: 'Dragon',
    status: 'ACTIVE',
    metric: '52 missions',
    note: 'Crew & cargo · ISS · commercial stations',
  },
  {
    program: 'Starshield',
    status: 'RAMPING',
    metric: 'Classified + allied',
    note: 'Gov connectivity derived from Starlink stack',
  },
];

export const SPCX_REUSABILITY_STATS: SpcxInvestorKpi[] = [
  {
    label: 'BOOSTER LANDINGS',
    value: '387+',
    sub: 'RTLS + ASDS recoveries',
    source: 'reported',
    asOf: '2026-Q2',
  },
  {
    label: 'FASTEST TURNAROUND',
    value: '13 days',
    sub: 'Booster reflight record',
    source: 'reported',
  },
  {
    label: 'COST PER KG (F9)',
    value: '~$2,600',
    sub: 'Rideshare benchmark era',
    source: 'estimate',
  },
  {
    label: 'STARSHIP TARGET',
    value: '<$100/kg',
    sub: 'Fully reusable ops goal',
    source: 'estimate',
  },
];

export const SPCX_FACILITIES: SpcxInvestorBullet[] = [
  { title: 'Hawthorne HQ', detail: 'Engineering, Dragon, mission control' },
  { title: 'Starbase TX', detail: 'Starship production & launch' },
  { title: 'Cape & Vandenberg', detail: 'Falcon east/west coast pads' },
  { title: 'Redmond & Austin', detail: 'Starlink software & consumer ops' },
];

export function spcxMetricBadge(source: SpcxMetricSource): string {
  if (source === 'live') return 'LIVE';
  if (source === 'reported') return 'REPORTED';
  return 'EST.';
}

export function spcxMetricBadgeClass(source: SpcxMetricSource): string {
  if (source === 'live') return 'spcx-inv-badge--live';
  if (source === 'reported') return 'spcx-inv-badge--reported';
  return 'spcx-inv-badge--estimate';
}

export function spacexLaunchMetrics(launches: Launch[]) {
  const spacex = filterSpaceXLaunches(launches);
  const cadence = launchCadenceMetrics(launches);
  const now = Date.now();

  const completed = spacex.filter((l) => new Date(l.date).getTime() <= now);
  const upcoming = spacex.filter((l) => new Date(l.date).getTime() > now);
  const withOutcome = completed.filter((l) => l.success != null);
  const successful = withOutcome.filter((l) => l.success === true).length;
  const successRate =
    withOutcome.length > 0 ? Math.round((successful / withOutcome.length) * 1000) / 10 : null;

  const starlinkCompleted = completed.filter(isStarlinkLaunch);
  const starlinkUpcoming = upcoming.filter(isStarlinkLaunch);

  return {
    totalListed: spacex.length,
    ytd: cadence.spacexYtd,
    starlinkYtd: cadence.ytd,
    last90: cadence.last90,
    daysSinceLast: cadence.daysSinceLast,
    avgDaysBetween: cadence.avgDaysBetween,
    starlinkShareYtd: cadence.starlinkShareYtd,
    upcomingCount: upcoming.length,
    starlinkUpcomingCount: starlinkUpcoming.length,
    completedCount: completed.length,
    starlinkCompletedCount: starlinkCompleted.length,
    successRate,
    nextLaunch: upcoming.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0] ?? null,
    lastLaunch: cadence.lastLaunch,
    upcoming: upcoming
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4),
  };
}

export function buildLaunchOpsKpis(
  launchMetrics: ReturnType<typeof spacexLaunchMetrics>
): SpcxInvestorKpi[] {
  const kpis: SpcxInvestorKpi[] = [
    {
      label: 'SPACEX LAUNCHES YTD',
      value: String(launchMetrics.ytd),
      sub: launchMetrics.starlinkShareYtd != null
        ? `${launchMetrics.starlinkYtd} Starlink (${launchMetrics.starlinkShareYtd}% of manifest)`
        : `${launchMetrics.starlinkYtd} Starlink`,
      source: 'live',
    },
    {
      label: 'LAST 90 DAYS',
      value: String(launchMetrics.last90),
      sub: 'Starlink + commercial + NASA',
      source: 'live',
    },
    {
      label: 'DAYS SINCE LAST',
      value: launchMetrics.daysSinceLast != null ? `${launchMetrics.daysSinceLast}d` : '—',
      sub: launchMetrics.lastLaunch?.name ?? 'From launch feed',
      source: 'live',
    },
    {
      label: 'AVG LAUNCH GAP',
      value: launchMetrics.avgDaysBetween != null ? `${launchMetrics.avgDaysBetween}d` : '—',
      sub: 'Mean interval · last 12 flights',
      source: 'live',
    },
    {
      label: 'UPCOMING',
      value: String(launchMetrics.upcomingCount),
      sub: `${launchMetrics.starlinkUpcomingCount} Starlink in feed`,
      source: 'live',
    },
  ];

  if (launchMetrics.successRate != null) {
    kpis.push({
      label: 'SUCCESS RATE',
      value: `${launchMetrics.successRate}%`,
      sub: `${launchMetrics.completedCount} completed in feed`,
      source: 'live',
    });
  }

  return kpis;
}

export function buildConstellationOpsKpis(intel: StarlinkIntelPayload): SpcxInvestorKpi[] {
  const total = intel.totalTracked || 1;
  const operationalPct = Math.round((intel.lifecycle.operational / total) * 1000) / 10;

  return [
    {
      label: 'NORAD TRACKED',
      value: intel.totalTracked.toLocaleString(),
      sub: 'Starlink constellation',
      source: 'live',
    },
    {
      label: 'LAUNCHED YTD',
      value: intel.launchedYtd.toLocaleString(),
      sub: 'New objects this year',
      source: 'live',
    },
    {
      label: 'OPERATIONAL',
      value: `${operationalPct}%`,
      sub: `${intel.lifecycle.raising} raising · ${intel.lifecycle.deorbiting} decay`,
      source: 'live',
    },
    {
      label: 'EPHEMERIDES',
      value: `${Math.round((intel.ephemerisPublished / total) * 1000) / 10}%`,
      sub: `${intel.ephemerisPublished.toLocaleString()} SpaceX published`,
      source: 'live',
    },
  ];
}

export function impliedStarlinkValue(marketCap: number | undefined): string | null {
  if (!marketCap) return null;
  const starlinkShare = 0.78;
  const val = marketCap * starlinkShare;
  if (val >= 1_000_000_000_000) return `$${(val / 1_000_000_000_000).toFixed(2)}T`;
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(0)}B`;
  return `$${(val / 1_000_000).toFixed(0)}M`;
}
