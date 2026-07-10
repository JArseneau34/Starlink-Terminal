import type Database from 'better-sqlite3';
import { SOURCE_FETCHERS } from './adapters/index.js';
import { fetchHistoricalWikipediaBootstrap } from './adapters/index.js';
import { buildDiffPayload, detectChangeType } from './diff.js';
import { ensurePolicyRegister } from './policyRegister.js';
import {
  queueReviewItem,
  reviewStatusForLaunch,
  upsertStarlinkSnapshot,
} from './reviewQueue.js';
import { seedStarlinkHistoryIfEmpty } from './seed.js';
import { computeAndSnapshot } from './snapshot.js';
import type { AdapterFetchResult, LaunchArchiveRow, StarlinkScraperLogRow, UpdateRunResult } from './types.js';
import { stableHash } from './hash.js';

function createUpdateRun(conn: Database.Database): number {
  const res = conn.prepare(`INSERT INTO update_runs(status) VALUES ('running')`).run();
  return Number(res.lastInsertRowid);
}

function completeUpdateRun(
  conn: Database.Database,
  runId: number,
  status: string,
  notes: string | null
): void {
  conn
    .prepare(`UPDATE update_runs SET status=?, completed_at=CURRENT_TIMESTAMP, notes=? WHERE id=?`)
    .run(status, notes, runId);
}

function alignLaunchKeyWithExisting(conn: Database.Database, row: LaunchArchiveRow): void {
  const existing = conn
    .prepare(`SELECT flight_no FROM launch_archive WHERE date_utc = ? ORDER BY flight_no DESC LIMIT 1`)
    .get(row.date_utc) as { flight_no: string } | undefined;
  if (existing) row.flight_no = existing.flight_no;
}

function processLaunchRow(
  conn: Database.Database,
  row: LaunchArchiveRow,
  runId: number,
  counters: { newRecords: number; changedRecords: number }
): void {
  alignLaunchKeyWithExisting(conn, row);
  const key = row.flight_no;
  const existing = conn.prepare('SELECT * FROM launch_archive WHERE flight_no = ?').get(key) as
    | Record<string, unknown>
    | undefined;
  const changeType = detectChangeType(existing, row as unknown as Record<string, unknown>);
  if (changeType === 'unchanged') return;

  const status = reviewStatusForLaunch(row);
  queueReviewItem(conn, {
    entity_type: 'launch_archive',
    entity_key: key,
    change_type: changeType,
    raw_payload: row as unknown as Record<string, unknown>,
    normalized_payload: row as unknown as Record<string, unknown>,
    diff_payload: buildDiffPayload(changeType),
    run_id: runId,
    status,
  });
  if (changeType === 'inserted') counters.newRecords += 1;
  else counters.changedRecords += 1;
}

function processFleetSnapshot(
  conn: Database.Database,
  snapshot: StarlinkScraperLogRow,
  runId: number,
  counters: { newRecords: number; changedRecords: number },
  autoApply: boolean
): void {
  const key = snapshot.snapshot_date;
  const existing = conn.prepare('SELECT * FROM starlink_scraper_log WHERE snapshot_date = ?').get(key) as
    | Record<string, unknown>
    | undefined;
  const changeType = detectChangeType(existing, snapshot as unknown as Record<string, unknown>);
  if (changeType === 'unchanged') return;

  if (autoApply) {
    upsertStarlinkSnapshot(conn, snapshot, true);
    if (changeType === 'inserted') counters.newRecords += 1;
    else counters.changedRecords += 1;
    return;
  }

  queueReviewItem(conn, {
    entity_type: 'starlink_scraper_log',
    entity_key: key,
    change_type: changeType,
    raw_payload: snapshot as unknown as Record<string, unknown>,
    normalized_payload: snapshot as unknown as Record<string, unknown>,
    diff_payload: buildDiffPayload(changeType),
    run_id: runId,
  });
  if (changeType === 'inserted') counters.newRecords += 1;
  else counters.changedRecords += 1;
}

function mergeAdapterResults(results: AdapterFetchResult[]): {
  launches: LaunchArchiveRow[];
  fleetSnapshots: StarlinkScraperLogRow[];
  notes: string[];
  errors: string[];
} {
  const launchMap = new Map<string, LaunchArchiveRow>();
  const fleetMap = new Map<string, StarlinkScraperLogRow>();
  const notes: string[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.notes?.length) notes.push(...result.notes.map((n) => `${result.source}:${n}`));
    if (!result.ok && result.error) errors.push(`${result.source}=${result.error}`);
    for (const launch of result.launches ?? []) launchMap.set(launch.flight_no, launch);
    for (const snap of result.fleetSnapshots ?? []) fleetMap.set(snap.snapshot_date, snap);
  }

  return {
    launches: [...launchMap.values()],
    fleetSnapshots: [...fleetMap.values()],
    notes,
    errors,
  };
}

export async function runSatStatsUpdate(
  conn: Database.Database,
  opts: { bootstrapHistorical?: boolean; autoApplyFleet?: boolean } = {}
): Promise<UpdateRunResult> {
  ensurePolicyRegister(conn);
  const runId = createUpdateRun(conn);
  const counters = { newRecords: 0, changedRecords: 0 };
  const notes: string[] = [];
  const errors: string[] = [];
  const sourceResults: AdapterFetchResult[] = [];

  try {
    const seeded = seedStarlinkHistoryIfEmpty(conn);
    if (seeded) notes.push(`starlink_history_seeded=${seeded}`);

    const bootstrapDone = conn.prepare(`SELECT 1 FROM bootstrap_flags WHERE name='historical_wikipedia'`).get();
    if (opts.bootstrapHistorical && !bootstrapDone) {
      sourceResults.push(await fetchHistoricalWikipediaBootstrap());
      conn.prepare(`INSERT OR IGNORE INTO bootstrap_flags(name) VALUES ('historical_wikipedia')`).run();
    }

    for (const fetcher of SOURCE_FETCHERS) {
      sourceResults.push(await fetcher());
    }

    const merged = mergeAdapterResults(sourceResults);
    notes.push(...merged.notes);
    errors.push(...merged.errors);

    for (const row of merged.launches) processLaunchRow(conn, row, runId, counters);

    for (const snap of merged.fleetSnapshots) {
      processFleetSnapshot(conn, snap, runId, counters, opts.autoApplyFleet ?? true);
    }

    const unresolved = conn
      .prepare(`SELECT COUNT(*) AS c FROM review_queue WHERE status='needs_assumption'`)
      .get() as { c: number };
    const pending = conn
      .prepare(`SELECT COUNT(*) AS c FROM review_queue WHERE status IN ('pending','needs_assumption')`)
      .get() as { c: number };

    const status =
      errors.length && counters.newRecords + counters.changedRecords === 0
        ? 'failed'
        : errors.length || unresolved.c
          ? 'partial'
          : 'complete';

    const noteStr = [...notes, ...errors].join(' | ') || null;
    completeUpdateRun(conn, runId, status, noteStr);

    let snapshotId: number | null = null;
    if (status !== 'failed') {
      snapshotId = computeAndSnapshot(conn, runId);
    }

    return {
      run_id: runId,
      status: status as UpdateRunResult['status'],
      new_records: counters.newRecords,
      changed_records: counters.changedRecords,
      pending_reviews: pending.c,
      needs_assumption_count: unresolved.c,
      snapshot_id: snapshotId,
      notes: noteStr ? noteStr.split(' | ') : [],
      source_results: sourceResults,
    };
  } catch (err) {
    completeUpdateRun(conn, runId, 'failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export function alignLaunchHashes(conn: Database.Database): void {
  const rows = conn.prepare('SELECT * FROM launch_archive').all() as LaunchArchiveRow[];
  const stmt = conn.prepare('UPDATE launch_archive SET source_hash=? WHERE flight_no=?');
  for (const row of rows) {
    const h = stableHash(row);
    stmt.run(h, row.flight_no);
  }
}
