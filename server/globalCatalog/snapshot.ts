import type Database from 'better-sqlite3';
import type { GlobalCatalogSnapshot } from '../../src/types/globalCatalog.js';
import {
  buildGlobalChartFeeds,
  buildGlobalDashboardKpis,
  buildObjectKindBreakdown,
  SAT_KIND_NON_PAYLOADS,
  SAT_KIND_PAYLOADS,
} from './compute.js';
import { loadAllGlobalLaunches, loadAllGlobalSatellites } from './repository.js';

type ComputeRow = Record<string, string | number | null | undefined>;

function feedsFor(
  launchRows: ComputeRow[],
  satelliteRows: ComputeRow[],
  orbitalOnly: boolean
): Record<string, unknown> {
  return {
    [SAT_KIND_PAYLOADS]: buildGlobalChartFeeds(launchRows, satelliteRows, {
      orbitalOnly,
      satelliteKind: SAT_KIND_PAYLOADS,
    }),
    [SAT_KIND_NON_PAYLOADS]: buildGlobalChartFeeds(launchRows, satelliteRows, {
      orbitalOnly,
      satelliteKind: SAT_KIND_NON_PAYLOADS,
    }),
  };
}

function dashboardFor(
  launchRows: ComputeRow[],
  satelliteRows: ComputeRow[],
  orbitalOnly: boolean
): Record<string, unknown> {
  return {
    [SAT_KIND_PAYLOADS]: buildGlobalDashboardKpis(launchRows, satelliteRows, {
      orbitalOnly,
      satelliteKind: SAT_KIND_PAYLOADS,
    }),
    [SAT_KIND_NON_PAYLOADS]: buildGlobalDashboardKpis(launchRows, satelliteRows, {
      orbitalOnly,
      satelliteKind: SAT_KIND_NON_PAYLOADS,
    }),
    object_kinds: buildObjectKindBreakdown(launchRows, satelliteRows, { orbitalOnly }),
  };
}

export function computeAndSnapshotGlobal(conn: Database.Database, runId: number | null = null): number {
  const launchRows = loadAllGlobalLaunches(conn) as ComputeRow[];
  const satelliteRows = loadAllGlobalSatellites(conn) as ComputeRow[];

  const feeds = {
    orbital: feedsFor(launchRows, satelliteRows, true),
    all: feedsFor(launchRows, satelliteRows, false),
  };
  const dashboard = {
    orbital: dashboardFor(launchRows, satelliteRows, true),
    all: dashboardFor(launchRows, satelliteRows, false),
  };

  const res = conn
    .prepare(
      `INSERT INTO global_compute_snapshots(run_id, feeds_json, dashboard_json) VALUES (?, ?, ?)`
    )
    .run(runId, JSON.stringify(feeds), JSON.stringify(dashboard));
  return Number(res.lastInsertRowid);
}

function coerceViews<T>(payload: unknown, defaultKeys: [string, string] = ['orbital', 'all']): Record<string, T> {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, T>;
    if (defaultKeys.some((k) => k in obj)) {
      return {
        [defaultKeys[0]]: obj[defaultKeys[0]] ?? obj[defaultKeys[1]] ?? ({} as T),
        [defaultKeys[1]]: obj[defaultKeys[1]] ?? obj[defaultKeys[0]] ?? ({} as T),
      };
    }
  }
  return {
    [defaultKeys[0]]: payload as T,
    [defaultKeys[1]]: payload as T,
  };
}

export function getLatestGlobalSnapshot(conn: Database.Database): GlobalCatalogSnapshot | null {
  const row = conn
    .prepare('SELECT * FROM global_compute_snapshots ORDER BY snapshot_id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    snapshot_id: Number(row.snapshot_id),
    run_id: row.run_id == null ? null : Number(row.run_id),
    created_at: String(row.created_at),
    feeds: coerceViews(JSON.parse(String(row.feeds_json))),
    dashboard: coerceViews(JSON.parse(String(row.dashboard_json))),
  };
}

export function hasGlobalSnapshot(conn: Database.Database): boolean {
  const row = conn
    .prepare('SELECT 1 AS ok FROM global_compute_snapshots LIMIT 1')
    .get() as { ok: number } | undefined;
  return row != null;
}
