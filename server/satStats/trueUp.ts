import type Database from 'better-sqlite3';
import { scrapeHistoricalWikipediaLaunches, scrapeWikipediaLaunches } from './adapters/wikipediaBootstrap.js';
import { apportionDeorbitedByGeneration, FCC_ATTRITION_LATEST } from './fccAttritionReference.js';
import { stableHash } from './hash.js';
import { queueReviewItem } from './reviewQueue.js';
import type { LaunchArchiveRow, StarlinkScraperLogRow } from './types.js';

export interface TrueUpLaunchDelta {
  flight_no: string;
  date_utc: string;
  before: number | null;
  after: number;
  wikipedia_source: string;
}

export interface TrueUpReport {
  generated_at: string;
  wikipedia_source: string;
  wikipedia_launches_scraped: number;
  launch_rows_updated: number;
  launch_sat_delta: number;
  snapshot_date: string | null;
  deorbited_before: Record<string, number> | null;
  deorbited_after: Record<string, number> | null;
  fcc_attrition_report: string;
  launch_deltas: TrueUpLaunchDelta[];
  oversized_diff: boolean;
  field_changes: number;
}

export interface TrueUpResult {
  review_id: number;
  report: TrueUpReport;
}

function wikiKey(date: string, payload: string): string {
  return `${date}|${payload.toLowerCase().slice(0, 80)}`;
}

function buildWikiCountIndex(
  wikiLaunches: LaunchArchiveRow[]
): Map<string, LaunchArchiveRow> {
  const byDate = new Map<string, LaunchArchiveRow[]>();
  for (const row of wikiLaunches) {
    if (row.payload_type !== 'Starlink') continue;
    const list = byDate.get(row.date_utc) ?? [];
    list.push(row);
    byDate.set(row.date_utc, list);
  }

  const index = new Map<string, LaunchArchiveRow>();
  for (const [date, rows] of byDate) {
    for (const row of rows) {
      const count = row.number_of_starlink_satellites ?? 0;
      if (count <= 0) continue;
      index.set(wikiKey(date, row.payload ?? ''), row);
      index.set(`${date}|*`, row);
    }
  }
  return index;
}

function matchWikiRow(
  existing: LaunchArchiveRow,
  index: Map<string, LaunchArchiveRow>
): LaunchArchiveRow | null {
  const exact = index.get(wikiKey(existing.date_utc, existing.payload ?? ''));
  if (exact) return exact;
  return index.get(`${existing.date_utc}|*`) ?? null;
}

async function loadWikipediaLaunchesForTrueUp(conn: Database.Database): Promise<{
  launches: LaunchArchiveRow[];
  source: string;
}> {
  try {
    const launches = await scrapeHistoricalWikipediaLaunches();
    return { launches, source: 'wikipedia_historical_scrape' };
  } catch {
    const cached = conn
      .prepare(
        `SELECT * FROM launch_archive WHERE source_id = 'wikipedia_bootstrap' AND payload_type = 'Starlink'`
      )
      .all() as LaunchArchiveRow[];
    if (cached.length > 0) {
      return { launches: cached, source: 'launch_archive_cache' };
    }
    const launches = await scrapeWikipediaLaunches();
    return { launches, source: 'wikipedia_main_scrape' };
  }
}

export async function buildTrueUpChangeset(conn: Database.Database): Promise<{
  launches: LaunchArchiveRow[];
  snapshot: StarlinkScraperLogRow | null;
  report: TrueUpReport;
}> {
  const { launches: wikiLaunches, source: wikiSource } = await loadWikipediaLaunchesForTrueUp(conn);
  const wikiIndex = buildWikiCountIndex(wikiLaunches);

  const existingLaunches = conn
    .prepare(
      `SELECT * FROM launch_archive WHERE payload_type = 'Starlink' ORDER BY date_utc, flight_no`
    )
    .all() as LaunchArchiveRow[];

  const launchDeltas: TrueUpLaunchDelta[] = [];
  const updatedLaunches: LaunchArchiveRow[] = [];
  let launchSatDelta = 0;

  for (const row of existingLaunches) {
    const wiki = matchWikiRow(row, wikiIndex);
    const wikiCount = wiki?.number_of_starlink_satellites ?? 0;
    if (wikiCount <= 0) continue;

    const before = row.number_of_starlink_satellites;
    if (before === wikiCount) continue;

    const patched: LaunchArchiveRow = {
      ...row,
      number_of_starlink_satellites: wikiCount,
      starlink_model: wiki?.starlink_model ?? row.starlink_model,
      of_which_dtc: wiki?.of_which_dtc ?? row.of_which_dtc ?? 0,
      source_id: 'wikipedia_trueup',
      description: wiki?.description ?? row.description,
    };
    patched.source_hash = stableHash(patched);
    updatedLaunches.push(patched);
    launchDeltas.push({
      flight_no: row.flight_no,
      date_utc: row.date_utc,
      before,
      after: wikiCount,
      wikipedia_source: wiki?.flight_no ?? 'wikipedia',
    });
    launchSatDelta += wikiCount - (before ?? 0);
  }

  const latestSnap = conn
    .prepare(`SELECT * FROM starlink_scraper_log ORDER BY snapshot_date DESC LIMIT 1`)
    .get() as StarlinkScraperLogRow | undefined;

  let patchedSnapshot: StarlinkScraperLogRow | null = null;
  let deorbitedBefore: Record<string, number> | null = null;
  let deorbitedAfter: Record<string, number> | null = null;

  if (latestSnap) {
    const apportioned = apportionDeorbitedByGeneration(latestSnap.total_down);
    deorbitedBefore = {
      down_v1: latestSnap.down_v1,
      down_v15: latestSnap.down_v15,
      down_v2_mini: latestSnap.down_v2_mini,
      down_v2_mini_d2c: latestSnap.down_v2_mini_d2c,
      down_v2_mini_opt: latestSnap.down_v2_mini_opt,
    };
    deorbitedAfter = {
      down_v1: apportioned.down_v1,
      down_v15: apportioned.down_v15,
      down_v2_mini: apportioned.down_v2_mini,
      down_v2_mini_d2c: apportioned.down_v2_mini_d2c,
      down_v2_mini_opt: apportioned.down_v2_mini_opt,
    };

    const changed =
      deorbitedBefore.down_v1 !== deorbitedAfter.down_v1 ||
      deorbitedBefore.down_v15 !== deorbitedAfter.down_v15 ||
      deorbitedBefore.down_v2_mini !== deorbitedAfter.down_v2_mini ||
      deorbitedBefore.down_v2_mini_d2c !== deorbitedAfter.down_v2_mini_d2c ||
      deorbitedBefore.down_v2_mini_opt !== deorbitedAfter.down_v2_mini_opt;

    if (changed) {
      const snap: StarlinkScraperLogRow = {
        ...latestSnap,
        ...apportioned,
        source_id: 'fcc_attrition_trueup',
      };
      snap.source_hash = stableHash(snap);
      patchedSnapshot = snap;
    }
  }

  const fieldChanges =
    launchDeltas.length +
    (patchedSnapshot ? Object.keys(deorbitedAfter ?? {}).length : 0);

  const report: TrueUpReport = {
    generated_at: new Date().toISOString(),
    wikipedia_source: wikiSource,
    wikipedia_launches_scraped: wikiLaunches.length,
    launch_rows_updated: launchDeltas.length,
    launch_sat_delta: launchSatDelta,
    snapshot_date: latestSnap?.snapshot_date ?? null,
    deorbited_before: deorbitedBefore,
    deorbited_after: deorbitedAfter,
    fcc_attrition_report: FCC_ATTRITION_LATEST.reportDate,
    launch_deltas: launchDeltas,
    oversized_diff: fieldChanges > 50,
    field_changes: fieldChanges,
  };

  return {
    launches: updatedLaunches,
    snapshot: patchedSnapshot,
    report,
  };
}

export async function queueTrueUpReview(conn: Database.Database, runId: number | null): Promise<TrueUpResult> {
  const { launches, snapshot, report } = await buildTrueUpChangeset(conn);

  if (!launches.length && !snapshot) {
    throw new Error('True-up found no changes — launch counts and deorbited split already match sources.');
  }

  const entityKey = `trueup-${report.generated_at.slice(0, 10)}`;
  const reviewId = queueReviewItem(conn, {
    entity_type: 'bulk_trueup',
    entity_key: entityKey,
    change_type: 'updated',
    raw_payload: report as unknown as Record<string, unknown>,
    normalized_payload: {
      launches,
      snapshot,
      report,
    },
    diff_payload: {
      change_type: 'updated',
      oversized: report.oversized_diff,
      field_changes: report.field_changes,
      launch_rows: launches.length,
      snapshot_patch: snapshot != null,
      approve_as_batch: true,
    },
    run_id: runId,
    status: 'pending',
  });

  return { review_id: reviewId, report };
}
