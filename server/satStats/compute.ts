import type Database from 'better-sqlite3';
import type { LaunchArchiveRow, StarlinkScraperLogRow } from './types.js';
import { CHART_FEED_KEYS } from './types.js';

function monthEnd(d: Date): string {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function pctSafe(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function trailing3(values: number[], idx: number): number {
  const window = values.slice(idx, idx + 3);
  if (!window.length) return 0;
  return window.reduce((a, b) => a + b, 0) / window.length;
}

interface AssumptionContext {
  subscriber_anchors: { anchor_date: string; subscribers: number }[];
  model_assumptions: Record<string, { mass_kg: number; downlink_gbps_per_sat: number }>;
}

function interpolateSubscribers(target: Date, anchors: AssumptionContext['subscriber_anchors']): number {
  const ordered = [...anchors].sort((a, b) => a.anchor_date.localeCompare(b.anchor_date));
  if (!ordered.length) return 0;
  const first = parseDate(ordered[0]!.anchor_date);
  if (target < first) return 0;
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const next = ordered[i]!;
    const prevDate = parseDate(prev.anchor_date);
    const nextDate = parseDate(next.anchor_date);
    if (target >= prevDate && target <= nextDate) {
      const span = (nextDate.getTime() - prevDate.getTime()) / 86_400_000 || 1;
      const elapsed = (target.getTime() - prevDate.getTime()) / 86_400_000;
      const t = elapsed / span;
      if (i === 1) return Math.round(prev.subscribers + (next.subscribers - prev.subscribers) * t);
      if (prev.subscribers <= 0) return 0;
      return Math.round(prev.subscribers * Math.pow(next.subscribers / prev.subscribers, t));
    }
  }
  if (ordered.length < 2) return ordered.at(-1)!.subscribers;
  const prev = ordered.at(-2)!;
  const next = ordered.at(-1)!;
  const prevDate = parseDate(prev.anchor_date);
  const nextDate = parseDate(next.anchor_date);
  const span = (nextDate.getTime() - prevDate.getTime()) / 86_400_000 || 1;
  const elapsed = (target.getTime() - nextDate.getTime()) / 86_400_000;
  if (prev.subscribers <= 0) return next.subscribers;
  return Math.round(next.subscribers * Math.pow(next.subscribers / prev.subscribers, elapsed / span));
}

export function loadAssumptions(conn: Database.Database): AssumptionContext {
  const subscriber_anchors = conn
    .prepare('SELECT anchor_date, subscribers FROM subscriber_anchors ORDER BY anchor_date')
    .all() as { anchor_date: string; subscribers: number }[];
  const modelRows = conn
    .prepare('SELECT model_key, mass_kg, downlink_gbps_per_sat FROM model_assumptions')
    .all() as { model_key: string; mass_kg: number; downlink_gbps_per_sat: number }[];
  const model_assumptions: AssumptionContext['model_assumptions'] = {};
  for (const row of modelRows) {
    model_assumptions[row.model_key] = {
      mass_kg: row.mass_kg,
      downlink_gbps_per_sat: row.downlink_gbps_per_sat,
    };
  }
  return { subscriber_anchors, model_assumptions };
}

export function buildLaunchData(launchRows: LaunchArchiveRow[]): Record<string, unknown>[] {
  const launches = launchRows.map((r) => ({ ...r, date_obj: parseDate(r.date_utc) }));
  const months = [...new Set(launches.map((r) => monthEnd(r.date_obj)))].sort().reverse();
  const results: Record<string, unknown>[] = [];

  for (const m of months) {
    const monthRows = launches.filter((r) => monthEnd(r.date_obj) === m);
    const total = monthRows.length;
    const starlink = monthRows.filter((r) => r.payload_type === 'Starlink').length;
    const customer = total - starlink;
    const f9 = monthRows.filter((r) => r.vehicle === 'Falcon 9').length;
    const fh = monthRows.filter((r) => r.vehicle === 'Falcon Heavy').length;
    const crew = monthRows.filter((r) => r.payload_type === 'Dragon Crew').length;
    const cargo = monthRows.filter((r) => r.payload_type === 'Dragon Cargo').length;
    const starship = monthRows.filter((r) => r.vehicle === 'Starship').length;
    const launchSuccess = monthRows.filter((r) => r.launch_outcome === 'Success').length;
    const landingAttempts = monthRows.filter((r) => r.booster_landing !== 'No attempt');
    const landingSuccess = landingAttempts.filter((r) =>
      String(r.booster_landing ?? '').includes('Success')
    ).length;
    results.push({
      month_end: m,
      total_launches: total,
      starlink_launches: starlink,
      customer_launches: customer,
      falcon_9: f9 || '',
      falcon_heavy: fh || '',
      dragon_crew: crew || '',
      dragon_cargo: cargo || '',
      starship: starship || '',
      starlink_pct: pctSafe(starlink, total),
      booster_launch_success: pctSafe(launchSuccess, total),
      booster_landing_success: pctSafe(landingSuccess, landingAttempts.length),
      monthly_launch_rate: total,
    });
  }

  const tLaunch = results.map((r) => Number(r.total_launches) || 0);
  const tStar = results.map((r) => Number(r.starlink_launches) || 0);
  const tCustomer = results.map((r) => Number(r.customer_launches) || 0);
  for (let idx = 0; idx < results.length; idx++) {
    results[idx]!.t3m_monthly_launch_rate = trailing3(tLaunch, idx);
    const t3Total = tLaunch.slice(idx, idx + 3).reduce((a, b) => a + b, 0);
    const t3Star = tStar.slice(idx, idx + 3).reduce((a, b) => a + b, 0);
    const t3Customer = tCustomer.slice(idx, idx + 3).reduce((a, b) => a + b, 0);
    results[idx]!.t3m_starlink_pct = pctSafe(t3Star, t3Total);
    results[idx]!.t3m_customer_pct = pctSafe(t3Customer, t3Total);
  }
  return results;
}

export function buildStarlinkData(
  launchRows: LaunchArchiveRow[],
  scraperRows: StarlinkScraperLogRow[],
  assumptions: AssumptionContext
): Record<string, unknown>[] {
  const launches = launchRows.map((r) => ({ ...r, date_obj: parseDate(r.date_utc) }));
  const snapshots = scraperRows.map((r) => ({ ...r, date_obj: parseDate(r.snapshot_date) }));
  const monthSet = new Set<string>();
  for (const r of launches) monthSet.add(monthEnd(r.date_obj));
  for (const s of snapshots) monthSet.add(monthEnd(s.date_obj));
  const months = [...monthSet].sort().reverse();
  const model = assumptions.model_assumptions;
  const rows: Record<string, unknown>[] = [];

  for (const m of months) {
    const monthLaunches = launches.filter((r) => monthEnd(r.date_obj) === m);
    const monthSnapshots = snapshots.filter((s) => s.date_obj <= parseDate(m));
    const latest = [...monthSnapshots].sort((a, b) => b.date_obj.getTime() - a.date_obj.getTime())[0];
    const sumModel = (modelKey: string) =>
      monthLaunches
        .filter((r) => r.starlink_model === modelKey)
        .reduce((sum, r) => sum + (r.number_of_starlink_satellites ?? 0), 0);
    const g = sumModel('v1');
    const h = sumModel('v1.5');
    const i = sumModel('v2 mini');
    const dtc = monthLaunches
      .filter((r) => r.starlink_model === 'v2 mini' && (r.of_which_dtc ?? 0) > 0)
      .reduce((sum, r) => sum + (r.number_of_starlink_satellites ?? 0), 0);
    const iOpt = sumModel('v2 mini opt');
    const v2NonDtc = Math.max(i - dtc, 0);
    const mass =
      g * (model.v1?.mass_kg ?? 0) +
      h * (model['v1.5']?.mass_kg ?? 0) +
      v2NonDtc * (model['v2 mini']?.mass_kg ?? 0) +
      dtc * (model['v2 mini d2c']?.mass_kg ?? 0) +
      iOpt * (model['v2 mini opt']?.mass_kg ?? 0);
    const bw =
      g * (model.v1?.downlink_gbps_per_sat ?? 0) +
      h * (model['v1.5']?.downlink_gbps_per_sat ?? 0) +
      v2NonDtc * (model['v2 mini']?.downlink_gbps_per_sat ?? 0) +
      dtc * (model['v2 mini d2c']?.downlink_gbps_per_sat ?? 0) +
      iOpt * (model['v2 mini opt']?.downlink_gbps_per_sat ?? 0);
    const totalCapacity = latest?.total_bandwidth_in_orbit_tbps ?? 0;
    rows.push({
      month_end: m,
      subscribers_total: interpolateSubscribers(parseDate(m), assumptions.subscriber_anchors),
      satellites_deployed_monthly: g + h + i + iOpt,
      active_satellites_total: latest?.total_working ?? 0,
      total_in_orbit_total: latest?.total_in_orbit ?? 0,
      deorbited_satellites_total: latest?.total_down ?? 0,
      satellites_deployed_total: latest?.total_sats_launched ?? 0,
      v1_launched_monthly: g,
      v15_launched_monthly: h,
      v2_mini_launched_monthly: i,
      v1_active: latest?.active_v1 ?? 0,
      v15_active: latest?.active_v15 ?? 0,
      v2_mini_active: latest?.active_v2_mini ?? 0,
      v2_mini_d2c_active: latest?.active_v2_mini_d2c ?? 0,
      v2_mini_opt_active: latest?.active_v2_mini_opt ?? 0,
      v1_down: latest?.down_v1 ?? 0,
      v15_down: latest?.down_v15 ?? 0,
      v2_mini_down: latest?.down_v2_mini ?? 0,
      v2_mini_d2c_down: latest?.down_v2_mini_d2c ?? 0,
      v2_mini_opt_down: latest?.down_v2_mini_opt ?? 0,
      total_est_bw_capacity_tbps: totalCapacity,
      est_monthly_bw_launched_gbps: bw,
      monthly_sat_upmass_kg: mass,
      gbps_per_kg_launched: bw ? totalCapacity / bw : 0,
    });
  }
  return rows;
}

export function buildChartFeeds(
  launchData: Record<string, unknown>[],
  starlinkData: Record<string, unknown>[]
): Record<string, Record<string, unknown>[]> {
  const byLaunch = new Map(launchData.map((r) => [String(r.month_end), r]));
  const byStar = new Map(starlinkData.map((r) => [String(r.month_end), r]));
  const months = [...new Set([...byLaunch.keys(), ...byStar.keys()])].sort();
  const feeds: Record<string, Record<string, unknown>[]> = {
    launches_by_vehicle: [],
    bandwidth_vs_customers: [],
    active_vs_deorbited_sats: [],
    bandwidth_density_vs_satlaunch: [],
    sat_model_segmentation: [],
    starlink_vs_customer_share: [],
  };

  for (const m of months) {
    const l = byLaunch.get(m) ?? {};
    const s = byStar.get(m) ?? {};
    const starlinkLaunches = Number(l.starlink_launches) || 0;
    const sats = Number(s.satellites_deployed_monthly) || 0;
    feeds.launches_by_vehicle!.push({
      month_end: m,
      falcon_9: l.falcon_9 ?? '',
      falcon_heavy: l.falcon_heavy ?? '',
      dragon_crew: l.dragon_crew ?? '',
      dragon_cargo: l.dragon_cargo ?? '',
      starship: l.starship ?? '',
    });
    feeds.bandwidth_vs_customers!.push({
      month_end: m,
      total_bandwidth_tbps: s.total_est_bw_capacity_tbps ?? 0,
      customers_imputed: s.subscribers_total ?? 0,
    });
    feeds.active_vs_deorbited_sats!.push({
      month_end: m,
      deorbited_satellites: s.deorbited_satellites_total ?? 0,
      active_satellites: s.active_satellites_total ?? 0,
      total_in_orbit: s.total_in_orbit_total ?? s.active_satellites_total ?? 0,
    });
    feeds.bandwidth_density_vs_satlaunch!.push({
      month_end: m,
      gbps_per_kg: s.gbps_per_kg_launched ?? 0,
      satellites_per_launch: starlinkLaunches ? Math.round(sats / starlinkLaunches) : '',
    });
    feeds.sat_model_segmentation!.push({
      month_end: m,
      v1: s.v1_active ?? 0,
      v15: s.v15_active ?? 0,
      v2_mini: s.v2_mini_active ?? 0,
      v2_mini_d2c: s.v2_mini_d2c_active ?? 0,
      v2_mini_opt: s.v2_mini_opt_active ?? 0,
    });
    feeds.starlink_vs_customer_share!.push({
      month_end: m,
      t3m_starlink_pct: l.t3m_starlink_pct ?? 0,
      t3m_customer_pct: l.t3m_customer_pct ?? 0,
    });
  }
  return feeds;
}

export function buildDashboardKpis(feeds: Record<string, Record<string, unknown>[]>): Record<string, unknown> {
  const launches = feeds.launches_by_vehicle ?? [];
  const active = feeds.active_vs_deorbited_sats ?? [];
  const bw = feeds.bandwidth_vs_customers ?? [];
  let totalLaunches = 0;
  for (const row of launches) {
    totalLaunches +=
      (Number(row.falcon_9) || 0) +
      (Number(row.falcon_heavy) || 0) +
      (Number(row.dragon_crew) || 0) +
      (Number(row.dragon_cargo) || 0) +
      (Number(row.starship) || 0);
  }
  const latestActive = active.at(-1) ?? {};
  const latestBw = bw.at(-1) ?? {};
  return {
    total_launches_all_time: totalLaunches,
    active_satellites: latestActive.active_satellites ?? 0,
    est_customers: latestBw.customers_imputed ?? 0,
    constellation_bw_tbps: latestBw.total_bandwidth_tbps ?? 0,
    deorbited_satellites: latestActive.deorbited_satellites ?? 0,
  };
}

export function computeSnapshot(conn: Database.Database): {
  launch_data: Record<string, unknown>[];
  starlink_data: Record<string, unknown>[];
  feeds: Record<string, Record<string, unknown>[]>;
  dashboard: Record<string, unknown>;
} {
  const launchRows = conn.prepare('SELECT * FROM launch_archive ORDER BY date_utc DESC').all() as LaunchArchiveRow[];
  const scraperRows = conn
    .prepare('SELECT * FROM starlink_scraper_log ORDER BY snapshot_date DESC')
    .all() as StarlinkScraperLogRow[];
  const assumptions = loadAssumptions(conn);
  const launch_data = buildLaunchData(launchRows);
  const starlink_data = buildStarlinkData(launchRows, scraperRows, assumptions);
  const feeds = buildChartFeeds(launch_data, starlink_data);
  const dashboard = buildDashboardKpis(feeds);
  for (const key of CHART_FEED_KEYS) {
    if (!feeds[key]) feeds[key] = [];
  }
  return { launch_data, starlink_data, feeds, dashboard };
}
