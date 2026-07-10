import 'dotenv/config';
import { getDb } from '../server/satStats/db.js';
import { runSatStatsUpdate } from '../server/satStats/orchestrator.js';
import { publishSnapshot } from '../server/satStats/publish.js';

const bootstrapHistorical = process.argv.includes('--bootstrap-historical');

async function main(): Promise<void> {
  const conn = getDb();
  console.log('[sat-stats] Running update...');
  const result = await runSatStatsUpdate(conn, { bootstrapHistorical });
  console.log(JSON.stringify(result, null, 2));
  if (result.snapshot_id) {
    const published = publishSnapshot(conn, result.snapshot_id, 'cli', 'full');
    console.log('[sat-stats] Published:', published);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
