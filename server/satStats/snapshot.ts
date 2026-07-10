import type Database from 'better-sqlite3';
import { computeSnapshot } from './compute.js';
import type { SatStatsSnapshot } from './types.js';

export function computeAndSnapshot(conn: Database.Database, runId: number | null = null): number {
  const { launch_data, starlink_data, feeds, dashboard } = computeSnapshot(conn);
  const res = conn
    .prepare(
      `INSERT INTO compute_snapshots(run_id, launch_data_json, starlink_data_json, feeds_json, dashboard_json)
       VALUES (?,?,?,?,?)`
    )
    .run(
      runId,
      JSON.stringify(launch_data),
      JSON.stringify(starlink_data),
      JSON.stringify(feeds),
      JSON.stringify(dashboard)
    );
  return Number(res.lastInsertRowid);
}

function rowToSnapshot(row: Record<string, unknown>): SatStatsSnapshot {
  return {
    snapshot_id: Number(row.snapshot_id),
    run_id: row.run_id == null ? null : Number(row.run_id),
    created_at: String(row.created_at),
    launch_data: JSON.parse(String(row.launch_data_json)) as Record<string, unknown>[],
    starlink_data: JSON.parse(String(row.starlink_data_json)) as Record<string, unknown>[],
    feeds: JSON.parse(String(row.feeds_json)) as Record<string, Record<string, unknown>[]>,
    dashboard: JSON.parse(String(row.dashboard_json)) as Record<string, unknown>,
  };
}

export function getLatestSnapshot(conn: Database.Database): SatStatsSnapshot | null {
  const row = conn
    .prepare('SELECT * FROM compute_snapshots ORDER BY snapshot_id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToSnapshot(row) : null;
}

export function getSnapshot(conn: Database.Database, snapshotId: number): SatStatsSnapshot | null {
  const row = conn
    .prepare('SELECT * FROM compute_snapshots WHERE snapshot_id = ?')
    .get(snapshotId) as Record<string, unknown> | undefined;
  return row ? rowToSnapshot(row) : null;
}
