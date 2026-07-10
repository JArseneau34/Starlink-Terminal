/** Compute layer for Global Catalog KPIs and chart feeds — ported from global_compute.py */

import {
  classifySatelliteSegment,
  SEGMENT_DISPLAY,
  SEGMENT_NON_PAYLOAD,
  SEGMENT_ORDER,
} from './segment.js';

export const SAT_KIND_PAYLOADS = 'payloads';
export const SAT_KIND_NON_PAYLOADS = 'non_payloads';

export const ACTIVE_STATUS_CODES = new Set(['O']);
export const REENTERED_STATUS_CODES = new Set(['R', 'AR', 'D', 'DR', 'L']);

export const OBJECT_KIND_PAYLOAD = 'payload';
export const OBJECT_KIND_ROCKET_STAGE = 'rocket_stage';
export const OBJECT_KIND_DEBRIS = 'debris';
export const OBJECT_KIND_COMPONENT = 'component';
export const OBJECT_KIND_OTHER = 'other';

export const OBJECT_KIND_ORDER = [
  OBJECT_KIND_PAYLOAD,
  OBJECT_KIND_DEBRIS,
  OBJECT_KIND_ROCKET_STAGE,
  OBJECT_KIND_COMPONENT,
  OBJECT_KIND_OTHER,
] as const;

export const OBJECT_KIND_DISPLAY: Record<string, string> = {
  [OBJECT_KIND_PAYLOAD]: 'Payloads',
  [OBJECT_KIND_DEBRIS]: 'Debris',
  [OBJECT_KIND_ROCKET_STAGE]: 'Rocket Stages',
  [OBJECT_KIND_COMPONENT]: 'Components / Capsules',
  [OBJECT_KIND_OTHER]: 'Other / Unknown',
};

const OBJECT_TYPE_FIRST_LETTER_TO_KIND: Record<string, string> = {
  P: OBJECT_KIND_PAYLOAD,
  R: OBJECT_KIND_ROCKET_STAGE,
  D: OBJECT_KIND_DEBRIS,
  C: OBJECT_KIND_COMPONENT,
};

type Row = Record<string, string | number | null | undefined>;

function yearFromIso(value: unknown): number | null {
  const text = String(value ?? '');
  if (text.length < 4) return null;
  const year = Number(text.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function isOrbitalLaunch(row: Row): boolean {
  const code = String(row.launch_code ?? '').trim().toUpperCase();
  return code.startsWith('O');
}

function isSuccessfulOrbitalLaunch(row: Row): boolean {
  return String(row.launch_code ?? '').trim().toUpperCase() === 'OS';
}

export function classifyObjectKind(row: Row): string {
  const objectType = String(row.object_type ?? '').trim().toUpperCase();
  if (!objectType) return OBJECT_KIND_OTHER;
  return OBJECT_TYPE_FIRST_LETTER_TO_KIND[objectType[0]!] ?? OBJECT_KIND_OTHER;
}

function isPayload(row: Row): boolean {
  return classifyObjectKind(row) === OBJECT_KIND_PAYLOAD;
}

function filterSatelliteKind(satelliteRows: Row[], satelliteKind: string): Row[] {
  if (satelliteKind === SAT_KIND_NON_PAYLOADS) {
    return satelliteRows.filter((r) => !isPayload(r));
  }
  return satelliteRows.filter((r) => isPayload(r));
}

function isActiveSatellite(row: Row): boolean {
  return ACTIVE_STATUS_CODES.has(String(row.status ?? '').trim().toUpperCase());
}

function isReenteredSatellite(row: Row): boolean {
  return REENTERED_STATUS_CODES.has(String(row.status ?? '').trim().toUpperCase());
}

function orbitalLaunchTags(launchRows: Row[]): Set<string> {
  const tags = new Set<string>();
  for (const row of launchRows) {
    if (!isOrbitalLaunch(row)) continue;
    const tag = String(row.launch_tag ?? '').trim();
    if (tag) tags.add(tag);
  }
  return tags;
}

function applyOrbitalFilter(
  launchRows: Row[],
  satelliteRows: Row[],
  orbitalOnly: boolean
): [Row[], Row[]] {
  if (!orbitalOnly) return [launchRows, satelliteRows];
  const filteredLaunches = launchRows.filter((r) => isOrbitalLaunch(r));
  const tags = orbitalLaunchTags(launchRows);
  const filteredSats = satelliteRows.filter((r) => tags.has(String(r.launch_tag ?? '').trim()));
  return [filteredLaunches, filteredSats];
}

export function buildGlobalDashboardKpis(
  launchRows: Row[],
  satelliteRows: Row[],
  options: { orbitalOnly?: boolean; satelliteKind?: string } = {}
): Record<string, unknown> {
  const orbitalOnly = options.orbitalOnly ?? false;
  const satelliteKind = options.satelliteKind ?? SAT_KIND_PAYLOADS;

  let launches = launchRows;
  let sats = satelliteRows;
  [launches, sats] = applyOrbitalFilter(launches, sats, orbitalOnly);
  sats = filterSatelliteKind(sats, satelliteKind);

  const orbitalLaunches = launches.filter((r) => isOrbitalLaunch(r)).length;
  const successful = launches.filter((r) => isSuccessfulOrbitalLaunch(r)).length;
  const active = sats.filter((r) => isActiveSatellite(r)).length;
  const reentered = sats.filter((r) => isReenteredSatellite(r)).length;

  const operatorCounts = new Map<string, number>();
  for (const row of launches) {
    const agency = String(row.agency ?? '').trim();
    if (!agency) continue;
    operatorCounts.set(agency, (operatorCounts.get(agency) ?? 0) + 1);
  }

  let topOperator = '';
  let topCount = 0;
  for (const [agency, count] of operatorCounts) {
    if (count > topCount) {
      topCount = count;
      topOperator = agency;
    }
  }

  return {
    total_launches_all_time: launches.length,
    orbital_launches: orbitalLaunches,
    successful_orbital_launches: successful,
    success_rate_pct: orbitalLaunches ? Math.round((100 * successful) / orbitalLaunches * 10) / 10 : 0,
    total_satellites_catalogued: sats.length,
    active_satellites: active,
    reentered_satellites: reentered,
    unique_operators: operatorCounts.size,
    top_operator: topOperator,
  };
}

export function buildGlobalChartFeeds(
  launchRows: Row[],
  satelliteRows: Row[],
  options: { orbitalOnly?: boolean; satelliteKind?: string } = {}
): Record<string, unknown[]> {
  const orbitalOnly = options.orbitalOnly ?? false;
  const satelliteKind = options.satelliteKind ?? SAT_KIND_PAYLOADS;

  let launches = launchRows;
  let sats = satelliteRows;
  [launches, sats] = applyOrbitalFilter(launches, sats, orbitalOnly);
  sats = filterSatelliteKind(sats, satelliteKind);

  const launchesByYear = new Map<number, { total: number; orbital: number; successful: number }>();
  for (const row of launches) {
    const year = yearFromIso(row.launch_date_iso);
    if (year == null) continue;
    const bucket = launchesByYear.get(year) ?? { total: 0, orbital: 0, successful: 0 };
    bucket.total += 1;
    if (isOrbitalLaunch(row)) {
      bucket.orbital += 1;
      if (isSuccessfulOrbitalLaunch(row)) bucket.successful += 1;
    }
    launchesByYear.set(year, bucket);
  }

  const launchesPerYear = [...launchesByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({ year, ...data }));

  const satsByYear = new Map<number, { launched: number; still_active: number }>();
  for (const row of sats) {
    const year = yearFromIso(row.l_date_iso);
    if (year == null) continue;
    const bucket = satsByYear.get(year) ?? { launched: 0, still_active: 0 };
    bucket.launched += 1;
    if (isActiveSatellite(row)) bucket.still_active += 1;
    satsByYear.set(year, bucket);
  }

  const satellitesPerYear = [...satsByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, d]) => ({ year, ...d }));

  const agencyCounter = new Map<string, number>();
  for (const row of launches) {
    if (!isOrbitalLaunch(row)) continue;
    const agency = String(row.agency ?? '').trim();
    if (!agency) continue;
    agencyCounter.set(agency, (agencyCounter.get(agency) ?? 0) + 1);
  }

  const topOperators = [...agencyCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([agency, launchesCount]) => ({ agency, launches: launchesCount }));

  const stateCounter = new Map<string, number>();
  for (const row of sats) {
    const state = String(row.state ?? '').trim();
    if (!state) continue;
    stateCounter.set(state, (stateCounter.get(state) ?? 0) + 1);
  }

  const satellitesByState = [...stateCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([state, satellites]) => ({ state, satellites }));

  const segmentYearCounter = new Map<number, Record<string, number>>();
  const segmentsTotal = new Map<string, number>();
  for (const row of sats) {
    const segment = classifySatelliteSegment(row);
    if (segment === SEGMENT_NON_PAYLOAD) continue;
    const year = yearFromIso(row.l_date_iso);
    if (year == null) continue;
    const bucket = segmentYearCounter.get(year) ?? Object.fromEntries(SEGMENT_ORDER.map((k) => [k, 0]));
    bucket[segment] = (bucket[segment] ?? 0) + 1;
    segmentYearCounter.set(year, bucket);
    segmentsTotal.set(segment, (segmentsTotal.get(segment) ?? 0) + 1);
  }

  const satellitesBySegmentPerYear = [...segmentYearCounter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, counts]) => {
      const row: Record<string, unknown> = { year };
      for (const segment of SEGMENT_ORDER) row[segment] = counts[segment] ?? 0;
      return row;
    });

  const segmentTotals = SEGMENT_ORDER.map((segment) => ({
    segment,
    label: SEGMENT_DISPLAY[segment],
    satellites: segmentsTotal.get(segment) ?? 0,
  }));

  const kindYearCounter = new Map<number, Record<string, number>>();
  const kindsTotal = new Map<string, number>();
  for (const row of sats) {
    const kind = classifyObjectKind(row);
    const year = yearFromIso(row.l_date_iso);
    kindsTotal.set(kind, (kindsTotal.get(kind) ?? 0) + 1);
    if (year == null) continue;
    const bucket = kindYearCounter.get(year) ?? Object.fromEntries(OBJECT_KIND_ORDER.map((k) => [k, 0]));
    bucket[kind] = (bucket[kind] ?? 0) + 1;
    kindYearCounter.set(year, bucket);
  }

  const satellitesByKindPerYear = [...kindYearCounter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, counts]) => {
      const entry: Record<string, unknown> = { year };
      for (const kind of OBJECT_KIND_ORDER) entry[kind] = counts[kind] ?? 0;
      return entry;
    });

  const satellitesByKindTotals = OBJECT_KIND_ORDER.filter((kind) => (kindsTotal.get(kind) ?? 0) > 0).map(
    (kind) => ({
      kind,
      label: OBJECT_KIND_DISPLAY[kind],
      satellites: kindsTotal.get(kind) ?? 0,
    })
  );

  const massByYear = new Map<number, number>();
  for (const row of sats) {
    const year = yearFromIso(row.l_date_iso);
    if (year == null) continue;
    const mass = Number(row.mass_kg ?? 0);
    if (!Number.isFinite(mass)) continue;
    massByYear.set(year, (massByYear.get(year) ?? 0) + mass);
  }

  const massToOrbitPerYear = [...massByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, massKg]) => ({ year, mass_kg: Math.round(massKg * 10) / 10 }));

  return {
    launches_per_year: launchesPerYear,
    satellites_per_year: satellitesPerYear,
    top_operators: topOperators,
    satellites_by_state: satellitesByState,
    satellites_by_segment_per_year: satellitesBySegmentPerYear,
    satellites_by_segment_totals: segmentTotals,
    satellites_by_kind_per_year: satellitesByKindPerYear,
    satellites_by_kind_totals: satellitesByKindTotals,
    mass_to_orbit_per_year: massToOrbitPerYear,
  };
}

export function buildObjectKindBreakdown(
  launchRows: Row[],
  satelliteRows: Row[],
  options: { orbitalOnly?: boolean } = {}
): Array<Record<string, unknown>> {
  const [, sats] = applyOrbitalFilter(launchRows, satelliteRows, options.orbitalOnly ?? false);
  const totals = new Map<string, number>();
  const active = new Map<string, number>();

  for (const row of sats) {
    const kind = classifyObjectKind(row);
    totals.set(kind, (totals.get(kind) ?? 0) + 1);
    if (isActiveSatellite(row)) active.set(kind, (active.get(kind) ?? 0) + 1);
  }

  const rows: Array<Record<string, unknown>> = OBJECT_KIND_ORDER.filter(
    (kind) => (totals.get(kind) ?? 0) > 0
  ).map((kind) => ({
    kind,
    label: OBJECT_KIND_DISPLAY[kind],
    total: totals.get(kind) ?? 0,
    active: active.get(kind) ?? 0,
  }));

  rows.push({
    kind: 'total',
    label: 'All Objects',
    total: [...totals.values()].reduce((a, b) => a + b, 0),
    active: [...active.values()].reduce((a, b) => a + b, 0),
  });

  return rows;
}

export function filterGlobalRows(
  launchRows: Row[],
  satelliteRows: Row[],
  options: { orbitalOnly: boolean; satelliteKind: string }
): [Row[], Row[]] {
  let [launches, sats] = applyOrbitalFilter(launchRows, satelliteRows, options.orbitalOnly);
  sats = filterSatelliteKind(sats, options.satelliteKind);
  return [launches, sats];
}
