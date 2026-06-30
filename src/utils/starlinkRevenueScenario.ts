import { STARLINK_BANDWIDTH_SERIES } from '../data/starlinkBandwidthSeries';
import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';
import type { StarlinkIntelPayload } from '../types/orbital';

/** Reported subscriber anchors used by the pipeline imputation model. */
export const SUBSCRIBER_ANCHORS = [
  { date: '2024-09-30', subscribers: 4_000_000, label: '4M subs reported' },
  { date: '2025-12-31', subscribers: 9_000_000, label: '9M subs reported' },
  { date: '2026-02-28', subscribers: 10_000_000, label: '10M subs reported' },
] as const;

/** Monthly blended consumer ARPU (USD) — public plan tiers + regional mix. */
const CONSUMER_ARPU_MONTHLY_USD = 105;
/** Enterprise, mobility, maritime & aviation uplift as a share of consumer ARR. */
const ENTERPRISE_UPLIFT_SHARE = 0.2;
/** Annual wholesale-equivalent value per in-orbit DTC satellite (early ramp). */
const DTC_ARR_PER_SAT_USD = 3_500;

export type RevenueBadge = 'reported' | 'estimate';

export interface RevenueStream {
  key: string;
  label: string;
  arrUsd: number;
  share: number;
  driver: string;
  badge: RevenueBadge;
}

export interface RevenueScenarioCase {
  key: 'bear' | 'base' | 'bull';
  label: string;
  arrUsd: number;
  subscriberTarget: number;
  monthlyArpu: number;
  growthNote: string;
}

export interface RevenueScenarioSnapshot {
  asOfMonth: string;
  subscribersImputed: number;
  subscriberYoYGrowthPct: number | null;
  bandwidthTbps: number;
  dtcSatellites: number;
  streams: RevenueStream[];
  scenarios: RevenueScenarioCase[];
  baseArrUsd: number;
}

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function priorYearMonth(monthEnd: string): string {
  const [year, month, day] = monthEnd.split('-');
  return `${Number(year) - 1}-${month}-${day}`;
}

function computeSubscriberYoY(series: typeof STARLINK_BANDWIDTH_SERIES, latestMonth: string) {
  const latest = series.find((r) => r.monthEnd === latestMonth);
  const prior = series.find((r) => r.monthEnd === priorYearMonth(latestMonth));
  if (!latest || !prior || prior.customersImputed <= 0) return null;
  return ((latest.customersImputed / prior.customersImputed) - 1) * 100;
}

function buildStreams(
  subscribers: number,
  dtcSats: number,
  consumerArpuMonthly: number,
  enterpriseShare: number,
  dtcPerSat: number
): RevenueStream[] {
  const consumerArr = subscribers * consumerArpuMonthly * 12;
  const enterpriseArr = consumerArr * enterpriseShare;
  const dtcArr = dtcSats * dtcPerSat;
  const total = consumerArr + enterpriseArr + dtcArr || 1;

  return [
    {
      key: 'consumer',
      label: 'Consumer broadband',
      arrUsd: consumerArr,
      share: consumerArr / total,
      driver: `${subscribers.toLocaleString()} subs × $${consumerArpuMonthly}/mo`,
      badge: 'estimate',
    },
    {
      key: 'enterprise',
      label: 'Enterprise & mobility',
      arrUsd: enterpriseArr,
      share: enterpriseArr / total,
      driver: `${(enterpriseShare * 100).toFixed(0)}% uplift on consumer ARR`,
      badge: 'estimate',
    },
    {
      key: 'dtc',
      label: 'Direct-to-cell',
      arrUsd: dtcArr,
      share: dtcArr / total,
      driver: `${dtcSats.toLocaleString()} DTC sats × $${(dtcPerSat / 1000).toFixed(1)}K/yr`,
      badge: 'estimate',
    },
  ];
}

export function formatArrUsd(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

export function buildRevenueScenario(intel: StarlinkIntelPayload | null): RevenueScenarioSnapshot {
  const series = STARLINK_BANDWIDTH_SERIES;
  const latest = series[series.length - 1]!;
  const models = intel?.authoritative.models ?? STARLINK_FLEET_SNAPSHOT.models;
  const dtcSatellites = models.v2MiniD2c;

  const subscriberYoYGrowthPct = computeSubscriberYoY(series, latest.monthEnd);
  const growthRate = subscriberYoYGrowthPct != null ? subscriberYoYGrowthPct / 100 : 0.5;

  const streams = buildStreams(
    latest.customersImputed,
    dtcSatellites,
    CONSUMER_ARPU_MONTHLY_USD,
    ENTERPRISE_UPLIFT_SHARE,
    DTC_ARR_PER_SAT_USD
  );
  const baseArrUsd = streams.reduce((sum, s) => sum + s.arrUsd, 0);

  const bearSubs = Math.round(latest.customersImputed * (1 + growthRate * 0.45));
  const baseSubs = Math.round(latest.customersImputed * (1 + growthRate * 0.85));
  const bullSubs = Math.round(latest.customersImputed * (1 + growthRate * 1.15));

  const scenarios: RevenueScenarioCase[] = [
    {
      key: 'bear',
      label: 'Bear',
      arrUsd: buildStreams(bearSubs, dtcSatellites, 95, ENTERPRISE_UPLIFT_SHARE * 0.85, DTC_ARR_PER_SAT_USD * 0.8)
        .reduce((s, r) => s + r.arrUsd, 0),
      subscriberTarget: bearSubs,
      monthlyArpu: 95,
      growthNote: 'Slower sub adds · ARPU compression',
    },
    {
      key: 'base',
      label: 'Base',
      arrUsd: buildStreams(baseSubs, dtcSatellites, CONSUMER_ARPU_MONTHLY_USD, ENTERPRISE_UPLIFT_SHARE, DTC_ARR_PER_SAT_USD)
        .reduce((s, r) => s + r.arrUsd, 0),
      subscriberTarget: baseSubs,
      monthlyArpu: CONSUMER_ARPU_MONTHLY_USD,
      growthNote: `Trajectory from ${formatMonth(latest.monthEnd)} imputation`,
    },
    {
      key: 'bull',
      label: 'Bull',
      arrUsd: buildStreams(
        bullSubs,
        Math.round(dtcSatellites * 1.35),
        112,
        ENTERPRISE_UPLIFT_SHARE * 1.15,
        DTC_ARR_PER_SAT_USD * 1.4
      ).reduce((s, r) => s + r.arrUsd, 0),
      subscriberTarget: bullSubs,
      monthlyArpu: 112,
      growthNote: 'DTC ramp + enterprise mix shift',
    },
  ];

  return {
    asOfMonth: latest.monthEnd,
    subscribersImputed: latest.customersImputed,
    subscriberYoYGrowthPct,
    bandwidthTbps: latest.totalBandwidthTbps,
    dtcSatellites,
    streams,
    scenarios,
    baseArrUsd,
  };
}
