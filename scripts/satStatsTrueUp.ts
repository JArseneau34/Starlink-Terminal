import { getDb } from '../server/satStats/db.js';
import { queueTrueUpReview } from '../server/satStats/trueUp.js';

async function main() {
  const conn = getDb();
  const runRes = conn.prepare(`INSERT INTO update_runs(status) VALUES ('trueup')`).run();
  const runId = Number(runRes.lastInsertRowid);
  const { review_id, report } = await queueTrueUpReview(conn, runId);

  conn
    .prepare(`UPDATE update_runs SET status='pending_review', completed_at=CURRENT_TIMESTAMP, notes=? WHERE id=?`)
    .run(
      `bulk_trueup review #${review_id} · ${report.field_changes} fields`,
      runId
    );

  console.log('── Sat-stats seed true-up ──');
  console.log(`  review_id:           ${review_id}`);
  console.log(`  wikipedia source:    ${report.wikipedia_source}`);
  console.log(`  wikipedia scraped:   ${report.wikipedia_launches_scraped}`);
  console.log(`  launch rows updated: ${report.launch_rows_updated}`);
  console.log(`  launch sat delta:    ${report.launch_sat_delta >= 0 ? '+' : ''}${report.launch_sat_delta}`);
  console.log(`  snapshot date:       ${report.snapshot_date ?? '—'}`);
  console.log(`  FCC attrition ref:   ${report.fcc_attrition_report}`);
  console.log(`  field changes:       ${report.field_changes}`);
  console.log(`  oversized batch:     ${report.oversized_diff}`);
  if (report.deorbited_before && report.deorbited_after) {
    console.log('  deorbited apportionment (before → after):');
    for (const key of Object.keys(report.deorbited_before)) {
      console.log(
        `    ${key}: ${report.deorbited_before[key]} → ${report.deorbited_after[key]}`
      );
    }
  }
  console.log('');
  console.log(`Approve via review queue: POST /api/sat-stats/reviews/${review_id}/approve`);
  console.log('  or Fleet Data → approve all (batch).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
