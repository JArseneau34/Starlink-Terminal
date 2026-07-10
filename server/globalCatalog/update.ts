import type Database from 'better-sqlite3';
import type { GlobalCatalogUpdateResult } from '../../src/types/globalCatalog.js';
import { completeUpdateRun, createUpdateRun } from './db.js';
import { fetchLaunchTsv, fetchSatcatTsv } from './gcatFetch.js';
import { parseGcatLaunchTsv, parseGcatSatcatTsv } from './gcatParse.js';
import {
  globalLaunchesCount,
  globalSatellitesCount,
  upsertGlobalLaunch,
  upsertGlobalSatellite,
} from './repository.js';
import { computeAndSnapshotGlobal } from './snapshot.js';

export async function runGlobalUpdate(conn: Database.Database): Promise<GlobalCatalogUpdateResult> {
  const runId = createUpdateRun(conn);
  const errors: string[] = [];
  const infos: string[] = [];
  let newLaunches = 0;
  let changedLaunches = 0;
  let newSatellites = 0;
  let changedSatellites = 0;

  try {
    let launchRows: Record<string, unknown>[] = [];
    let satelliteRows: Record<string, unknown>[] = [];

    try {
      launchRows = parseGcatLaunchTsv(await fetchLaunchTsv());
    } catch (err) {
      errors.push(`gcat_launch_fetch_error=${err instanceof Error ? err.message : err}`);
    }

    try {
      satelliteRows = parseGcatSatcatTsv(await fetchSatcatTsv());
    } catch (err) {
      errors.push(`gcat_satcat_fetch_error=${err instanceof Error ? err.message : err}`);
    }

    const apply = conn.transaction(() => {
      for (const row of launchRows) {
        const [change] = upsertGlobalLaunch(conn, row);
        if (change === 'inserted') newLaunches += 1;
        else if (change === 'updated') changedLaunches += 1;
      }
      for (const row of satelliteRows) {
        const [change] = upsertGlobalSatellite(conn, row);
        if (change === 'inserted') newSatellites += 1;
        else if (change === 'updated') changedSatellites += 1;
      }
    });
    apply();

    infos.push(`global_launches_total=${globalLaunchesCount(conn)}`);
    infos.push(`global_satellites_total=${globalSatellitesCount(conn)}`);

    const status = errors.length ? 'partial' : 'succeeded';
    const notes = [...infos, ...errors].join(' | ') || null;
    completeUpdateRun(conn, runId, status, notes);

    const snapshotId = computeAndSnapshotGlobal(conn, runId);

    return {
      run_id: runId,
      status,
      new_launches: newLaunches,
      changed_launches: changedLaunches,
      new_satellites: newSatellites,
      changed_satellites: changedSatellites,
      pending_reviews: 0,
      snapshot_id: snapshotId,
      notes,
    };
  } catch (err) {
    completeUpdateRun(conn, runId, 'failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
