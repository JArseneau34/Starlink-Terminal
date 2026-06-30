import { STARLINK_BANDWIDTH_SERIES } from '../data/starlinkBandwidthSeries';
import { SUBSCRIBER_ANCHORS } from './starlinkRevenueScenario';
import { buildModelEconomics } from './starlinkModelEconomics';
import type { StarlinkIntelPayload } from '../types/orbital';

export type CatalystHorizon = 'completed' | 'near' | 'medium';
export type CatalystCategory = 'revenue' | 'capacity' | 'product' | 'capital';
export type CatalystImpact = 'high' | 'medium';

export interface CatalystEvent {
  id: string;
  dateLabel: string;
  sortKey: string;
  horizon: CatalystHorizon;
  category: CatalystCategory;
  title: string;
  detail: string;
  valuationHook: string;
  impact: CatalystImpact;
}

export interface CatalystTimelineSnapshot {
  events: CatalystEvent[];
  nextCatalyst: CatalystEvent | null;
}

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatSubs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function milestoneFromSeries(
  id: string,
  threshold: number,
  field: 'customersImputed' | 'totalBandwidthTbps',
  title: string,
  valuationHook: string,
  category: CatalystCategory
): CatalystEvent | null {
  const hit = STARLINK_BANDWIDTH_SERIES.find((row) => row[field] >= threshold);
  if (!hit) return null;
  const value =
    field === 'customersImputed'
      ? `${formatSubs(hit.customersImputed)} subscribers`
      : `${hit.totalBandwidthTbps.toFixed(1)} Tbps`;
  return {
    id,
    dateLabel: formatMonth(hit.monthEnd),
    sortKey: hit.monthEnd,
    horizon: 'completed',
    category,
    title,
    detail: `Pipeline imputation crossed ${field === 'customersImputed' ? formatSubs(threshold) : `${threshold} Tbps`} (${value}).`,
    valuationHook,
    impact: 'high',
  };
}

export function buildCatalystTimeline(intel: StarlinkIntelPayload | null): CatalystTimelineSnapshot {
  const econ = buildModelEconomics(intel);
  const v2Entry = econ.entries.find((e) => e.key === 'v2mini');
  const dtcEntry = econ.entries.find((e) => e.key === 'dtc');

  const completed: CatalystEvent[] = [];

  for (const anchor of SUBSCRIBER_ANCHORS) {
    completed.push({
      id: `anchor-${anchor.date}`,
      dateLabel: formatMonth(anchor.date),
      sortKey: anchor.date,
      horizon: 'completed',
      category: 'revenue',
      title: anchor.label,
      detail: 'Reported subscriber anchor in the Mach33 / pipeline model.',
      valuationHook: 'Proves consumer adoption velocity — core ARR driver.',
      impact: anchor.subscribers >= 9_000_000 ? 'high' : 'medium',
    });
  }

  const m10m = milestoneFromSeries(
    'subs-10m',
    10_000_000,
    'customersImputed',
    '10M+ imputed subscribers',
    'Crosses the scale where Starlink is a global ISP, not a niche product.',
    'revenue'
  );
  if (m10m) completed.push(m10m);

  const m600 = milestoneFromSeries(
    'cap-600',
    600,
    'totalBandwidthTbps',
    '600 Tbps constellation capacity',
    'Gen-2 density unlocks throughput-led revenue without proportional capex.',
    'capacity'
  );
  if (m600) completed.push(m600);

  const m688 = milestoneFromSeries(
    'cap-688',
    688,
    'totalBandwidthTbps',
    '688 Tbps working fleet capacity',
    'Latest McDowell-modeled capacity — sets the ceiling for monetizable bandwidth.',
    'capacity'
  );
  if (m688) completed.push(m688);

  if (v2Entry && v2Entry.capacityShare >= 0.85) {
    completed.push({
      id: 'v2-dominance',
      dateLabel: formatMonth(econ.snapshotDate),
      sortKey: econ.snapshotDate,
      horizon: 'completed',
      category: 'capacity',
      title: 'V2 Mini dominates capacity mix',
      detail: `${(v2Entry.capacityShare * 100).toFixed(0)}% of constellation broadband from Gen-2 Mini hardware.`,
      valuationHook: '4× capacity per sat vs V1.5 improves unit economics on every launch.',
      impact: 'high',
    });
  }

  if (dtcEntry && dtcEntry.count > 0) {
    completed.push({
      id: 'dtc-fleet',
      dateLabel: formatMonth(econ.snapshotDate),
      sortKey: econ.snapshotDate,
      horizon: 'completed',
      category: 'product',
      title: `${dtcEntry.count.toLocaleString()} DTC satellites deployed`,
      detail: 'Dedicated direct-to-cell layer operational in the working fleet.',
      valuationHook: 'Opens a second revenue stack beyond fixed broadband ARPU.',
      impact: 'high',
    });
  }

  const forward: CatalystEvent[] = [
    {
      id: 'dtc-carrier-scale',
      dateLabel: 'H2 2026',
      sortKey: '2026-09-30',
      horizon: 'near',
      category: 'revenue',
      title: 'DTC carrier wholesale scale-out',
      detail: 'More MNO roaming deals convert orbital DTC capacity into recurring wholesale ARR.',
      valuationHook: 'Re-rates Starlink from ISP to telecom infrastructure — higher multiple potential.',
      impact: 'high',
    },
    {
      id: 'enterprise-mix',
      dateLabel: '2026–27',
      sortKey: '2027-03-31',
      horizon: 'near',
      category: 'revenue',
      title: 'Enterprise & mobility ARPU uplift',
      detail: 'Aviation, maritime and business lines carry higher ARPU than residential.',
      valuationHook: 'Mix shift lifts revenue per subscriber without proportional launch spend.',
      impact: 'medium',
    },
    {
      id: 'subs-15m',
      dateLabel: '2027E',
      sortKey: '2027-06-30',
      horizon: 'medium',
      category: 'revenue',
      title: '15M subscriber threshold',
      detail: 'Next adoption milestone on the imputed subscriber curve.',
      valuationHook: 'Crossing 15M validates TAM expansion and supports premium growth valuation.',
      impact: 'high',
    },
    {
      id: 'starship-cadence',
      dateLabel: '2026–27',
      sortKey: '2027-09-30',
      horizon: 'medium',
      category: 'capital',
      title: 'Starship launch economics',
      detail: 'Heavier lift + lower marginal cost per kg reshapes constellation capex efficiency.',
      valuationHook: 'Lowers the cost to add revenue-generating capacity — margin expansion catalyst.',
      impact: 'high',
    },
    {
      id: 'liquidity-event',
      dateLabel: 'TBD',
      sortKey: '2028-01-01',
      horizon: 'medium',
      category: 'capital',
      title: 'Starlink liquidity / IPO path',
      detail: 'A public listing or partial liquidity event would crystallize the orbital revenue story.',
      valuationHook: 'Unlocks comp-based valuation vs terrestrial telecom & infrastructure peers.',
      impact: 'high',
    },
  ];

  const events = [...completed, ...forward].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const nextCatalyst = events.find((e) => e.horizon !== 'completed') ?? null;

  return { events, nextCatalyst };
}
