import 'dotenv/config';
import { getGlobalBootstrapStatus, runGlobalGcatBootstrap } from '../server/globalCatalog/bootstrap.js';
import { closeDb, getDb } from '../server/globalCatalog/db.js';
import { globalLaunchesCount, globalSatellitesCount } from '../server/globalCatalog/repository.js';
import { computeAndSnapshotGlobal, getLatestGlobalSnapshot } from '../server/globalCatalog/snapshot.js';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const conn = getDb();

  console.log('[global-catalog] Starting GCAT bootstrap...');
  const result = await runGlobalGcatBootstrap(conn, { force });

  if (result.skipped) {
    console.log('[global-catalog] Skipped:', result.reason);
  } else if (result.warning) {
    console.warn('[global-catalog] Warning:', result.warning);
  } else {
    console.log(
      `[global-catalog] Parsed ${result.launch_rows_parsed?.toLocaleString()} launches, ${result.satellite_rows_parsed?.toLocaleString()} satellites`
    );
    console.log('[global-catalog] Launches:', result.launches);
    console.log('[global-catalog] Satellites:', result.satellites);
  }

  if (!result.skipped && result.launch_rows_parsed && result.satellite_rows_parsed) {
    const snapshotId = computeAndSnapshotGlobal(conn, null);
    console.log(`[global-catalog] Snapshot #${snapshotId} computed`);
  }

  const status = getGlobalBootstrapStatus(conn);
  console.log('[global-catalog] Bootstrap status:', status);

  const snap = getLatestGlobalSnapshot(conn);
  if (snap) {
    const dashboard = snap.dashboard as Record<string, unknown>;
    const orbital = dashboard.orbital as Record<string, unknown> | undefined;
    const dash = (orbital?.payloads ?? orbital) as Record<string, unknown> | undefined;
    console.log('[global-catalog] Sample KPIs (orbital/payloads):', {
      orbital_launches: dash?.orbital_launches,
      active_satellites: dash?.active_satellites,
      success_rate_pct: dash?.success_rate_pct,
    });
  }

  console.log(
    `[global-catalog] DB totals: ${globalLaunchesCount(conn).toLocaleString()} launches, ${globalSatellitesCount(conn).toLocaleString()} satellites`
  );

  closeDb();
}

main().catch((err) => {
  console.error('[global-catalog] Bootstrap failed:', err);
  closeDb();
  process.exit(1);
});
