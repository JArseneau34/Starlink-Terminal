import type Database from 'better-sqlite3';
import { BOOTSTRAP_FLAG_GCAT } from './config.js';
import { fetchLaunchTsv, fetchSatcatTsv } from './gcatFetch.js';
import { parseGcatLaunchTsv, parseGcatSatcatTsv } from './gcatParse.js';
import {
  globalLaunchesCount,
  globalSatellitesCount,
  upsertGlobalLaunch,
  upsertGlobalSatellite,
} from './repository.js';
import type { ChangeType } from './repository.js';

function flagPresent(conn: Database.Database): boolean {
  const row = conn
    .prepare('SELECT 1 AS ok FROM bootstrap_flags WHERE name = ?')
    .get(BOOTSTRAP_FLAG_GCAT) as { ok: number } | undefined;
  return row != null;
}

export function clearStaleGlobalBootstrapFlag(conn: Database.Database): boolean {
  if (!flagPresent(conn)) return false;
  if (globalLaunchesCount(conn) > 0 && globalSatellitesCount(conn) > 0) return false;
  conn.prepare('DELETE FROM bootstrap_flags WHERE name = ?').run(BOOTSTRAP_FLAG_GCAT);
  return true;
}

export function globalBootstrapDone(conn: Database.Database): boolean {
  clearStaleGlobalBootstrapFlag(conn);
  if (!flagPresent(conn)) return false;
  return globalLaunchesCount(conn) > 0 && globalSatellitesCount(conn) > 0;
}

function applyRows(
  conn: Database.Database,
  rows: Array<Record<string, string | number | null>>,
  upsertFn: (conn: Database.Database, row: Record<string, string | number | null>) => [ChangeType, string]
): Record<string, number> {
  const counts = { inserted: 0, updated: 0, unchanged: 0 };
  for (const row of rows) {
    const [change] = upsertFn(conn, row);
    counts[change] += 1;
  }
  return counts;
}

export interface GlobalBootstrapResult {
  skipped: boolean;
  reason?: string;
  warning?: string;
  launch_rows_parsed?: number;
  satellite_rows_parsed?: number;
  launches?: Record<string, number>;
  satellites?: Record<string, number>;
  snapshot_id?: number;
}

export async function runGlobalGcatBootstrap(
  conn: Database.Database,
  options: { force?: boolean } = {}
): Promise<GlobalBootstrapResult> {
  const force = options.force ?? false;

  if (!force && globalBootstrapDone(conn)) {
    return {
      skipped: true,
      reason: 'already_completed; re-run with force=true or delete bootstrap_flags row',
    };
  }

  const launchText = await fetchLaunchTsv();
  const satcatText = await fetchSatcatTsv();
  const launchRows = parseGcatLaunchTsv(launchText);
  const satelliteRows = parseGcatSatcatTsv(satcatText);

  if (!launchRows.length || !satelliteRows.length) {
    return {
      skipped: false,
      warning: `empty_payload launch_rows=${launchRows.length} satellite_rows=${satelliteRows.length}; bootstrap flag not set`,
      launch_rows_parsed: launchRows.length,
      satellite_rows_parsed: satelliteRows.length,
    };
  }

  if (force) {
    conn.prepare('DELETE FROM bootstrap_flags WHERE name = ?').run(BOOTSTRAP_FLAG_GCAT);
  }

  const tx = conn.transaction(() => {
    const launches = applyRows(conn, launchRows, upsertGlobalLaunch);
    const satellites = applyRows(conn, satelliteRows, upsertGlobalSatellite);
    conn.prepare('INSERT INTO bootstrap_flags(name) VALUES(?)').run(BOOTSTRAP_FLAG_GCAT);
    return { launches, satellites };
  });

  const { launches, satellites } = tx();

  return {
    skipped: false,
    launch_rows_parsed: launchRows.length,
    satellite_rows_parsed: satelliteRows.length,
    launches,
    satellites,
  };
}

export function getGlobalBootstrapStatus(conn: Database.Database): {
  done: boolean;
  can_run: boolean;
  global_launches_count: number;
  global_satellites_count: number;
} {
  const launches = globalLaunchesCount(conn);
  const satellites = globalSatellitesCount(conn);
  const done = globalBootstrapDone(conn);
  return {
    done,
    can_run: !done,
    global_launches_count: launches,
    global_satellites_count: satellites,
  };
}
