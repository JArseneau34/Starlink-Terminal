import { Router } from 'express';
import { getDb } from './db.js';
import { listModelAssumptions, listSubscriberAnchors, upsertModelAssumption } from './assumptions.js';
import { listPolicies } from './policyRegister.js';
import { runSatStatsUpdate } from './orchestrator.js';
import { buildChartFeedsZip, exportLayer1RawCsvs, publishSnapshot } from './publish.js';
import { computeAndSnapshot } from './snapshot.js';
import {
  approveAllPendingReviews,
  approveReview,
  getReview,
  listPendingReviews,
  updateReviewStatus,
} from './reviewQueue.js';
import { getLatestSnapshot, getSnapshot } from './snapshot.js';

import { queueTrueUpReview } from './trueUp.js';

export const satStatsRouter = Router();

satStatsRouter.get('/health', (_req, res) => {
  res.json({ ok: true, module: 'sat-stats', timestamp: new Date().toISOString() });
});

satStatsRouter.get('/sources', (_req, res) => {
  const conn = getDb();
  res.json({ sources: listPolicies(conn) });
});

satStatsRouter.get('/snapshot/latest', (_req, res) => {
  const snap = getLatestSnapshot(getDb());
  if (!snap) {
    res.status(404).json({ error: 'No snapshot available. Run POST /api/sat-stats/update first.' });
    return;
  }
  res.json(snap);
});

satStatsRouter.get('/snapshot/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid snapshot id' });
    return;
  }
  const snap = getSnapshot(getDb(), id);
  if (!snap) {
    res.status(404).json({ error: 'Snapshot not found' });
    return;
  }
  res.json(snap);
});

satStatsRouter.post('/true-up', async (req, res) => {
  try {
    const conn = getDb();
    const runRes = conn.prepare(`INSERT INTO update_runs(status) VALUES ('trueup')`).run();
    const runId = Number(runRes.lastInsertRowid);
    const result = await queueTrueUpReview(conn, runId);
    conn
      .prepare(`UPDATE update_runs SET status='pending_review', completed_at=CURRENT_TIMESTAMP, notes=? WHERE id=?`)
      .run(
        `bulk_trueup review #${result.review_id} · ${result.report.field_changes} fields · oversized=${result.report.oversized_diff}`,
        runId
      );
    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: 'True-up failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

satStatsRouter.post('/update', async (req, res) => {
  try {
    const bootstrapHistorical = Boolean(req.body?.bootstrap_historical);
    const result = await runSatStatsUpdate(getDb(), {
      bootstrapHistorical,
      autoApplyFleet: req.body?.auto_apply_fleet !== false,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: 'Sat stats update failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

satStatsRouter.get('/reviews', (_req, res) => {
  res.json({ reviews: listPendingReviews(getDb()) });
});

satStatsRouter.get('/reviews/:id', (req, res) => {
  const id = Number(req.params.id);
  const review = getReview(getDb(), id);
  if (!review) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  res.json(review);
});

satStatsRouter.post('/reviews/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const reviewer = String(req.body?.reviewer ?? 'api');
  try {
    approveReview(getDb(), id, reviewer, req.body?.edited_payload ?? null);
    res.json({ ok: true, id, status: 'approved' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

satStatsRouter.post('/reviews/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const reviewer = String(req.body?.reviewer ?? 'api');
  updateReviewStatus(getDb(), id, 'rejected', reviewer, req.body?.note ?? 'rejected');
  res.json({ ok: true, id, status: 'rejected' });
});

satStatsRouter.post('/reviews/approve-all', (req, res) => {
  const reviewer = String(req.body?.reviewer ?? 'api');
  const result = approveAllPendingReviews(getDb(), reviewer);
  res.json(result);
});

satStatsRouter.post('/publish', (req, res) => {
  const conn = getDb();
  const snap = req.body?.snapshot_id
    ? getSnapshot(conn, Number(req.body.snapshot_id))
    : getLatestSnapshot(conn);
  if (!snap) {
    res.status(404).json({ error: 'No snapshot to publish' });
    return;
  }
  const actor = String(req.body?.actor ?? 'api');
  const mode = String(req.body?.mode ?? 'full');
  const result = publishSnapshot(conn, snap.snapshot_id, actor, mode);
  res.json({ snapshot_id: snap.snapshot_id, ...result });
});

satStatsRouter.post('/export/layer1', (_req, res) => {
  res.json(exportLayer1RawCsvs(getDb()));
});

satStatsRouter.get('/assumptions', (_req, res) => {
  const conn = getDb();
  res.json({
    models: listModelAssumptions(conn),
    subscriber_anchors: listSubscriberAnchors(conn),
  });
});

satStatsRouter.post('/assumptions/model', (req, res) => {
  const model_key = String(req.body?.model_key ?? '');
  const mass_kg = Number(req.body?.mass_kg);
  const downlink_gbps_per_sat = Number(req.body?.downlink_gbps_per_sat);
  if (!model_key || !Number.isFinite(mass_kg) || !Number.isFinite(downlink_gbps_per_sat)) {
    res.status(400).json({ error: 'model_key, mass_kg, downlink_gbps_per_sat required' });
    return;
  }
  upsertModelAssumption(getDb(), { model_key, mass_kg, downlink_gbps_per_sat });
  const conn = getDb();
  const snapshotId = computeAndSnapshot(conn);
  res.json({ ok: true, snapshot_id: snapshotId });
});

satStatsRouter.get('/bootstrap/historical-wikipedia-launches/status', (_req, res) => {
  const conn = getDb();
  const done = Boolean(
    conn.prepare(`SELECT 1 FROM bootstrap_flags WHERE name='historical_wikipedia'`).get()
  );
  const launch_archive_count = (
    conn.prepare('SELECT COUNT(*) AS c FROM launch_archive').get() as { c: number }
  ).c;
  res.json({ done, launch_archive_count });
});

satStatsRouter.post('/bootstrap/historical-wikipedia-launches', async (req, res) => {
  const force = req.query.force === 'true' || req.body?.force === true;
  const conn = getDb();
  if (!force) {
    const done = conn.prepare(`SELECT 1 FROM bootstrap_flags WHERE name='historical_wikipedia'`).get();
    if (done) {
      res.json({ ok: true, skipped: true, message: 'Historical bootstrap already completed' });
      return;
    }
  }
  try {
    const result = await runSatStatsUpdate(conn, { bootstrapHistorical: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: 'Historical bootstrap failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

satStatsRouter.post('/publish/:id/csv-download', async (req, res) => {
  const snapshotId = Number(req.params.id);
  if (!Number.isFinite(snapshotId)) {
    res.status(400).json({ error: 'Invalid snapshot id' });
    return;
  }
  try {
    const zip = await buildChartFeedsZip(getDb(), snapshotId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="starlink-chart-feeds-snapshot-${snapshotId}.zip"`
    );
    res.send(zip);
  } catch (err) {
    res.status(500).json({
      error: 'CSV export failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
