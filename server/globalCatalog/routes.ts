import { Router } from 'express';
import { getGlobalBootstrapStatus, runGlobalGcatBootstrap } from './bootstrap.js';
import { getDb } from './db.js';
import { buildGlobalCsvZip } from './export.js';
import { computeAndSnapshotGlobal, getLatestGlobalSnapshot, hasGlobalSnapshot } from './snapshot.js';
import { runGlobalUpdate } from './update.js';

export const globalCatalogRouter = Router();

globalCatalogRouter.get('/health', (_req, res) => {
  try {
    const conn = getDb();
    res.json({
      ok: true,
      module: 'global-catalog',
      pipeline: false,
      local: true,
      hasSnapshot: hasGlobalSnapshot(conn),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      module: 'global-catalog',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

globalCatalogRouter.get('/snapshot/latest', (_req, res) => {
  try {
    const conn = getDb();
    const snap = getLatestGlobalSnapshot(conn);
    if (!snap) {
      res.status(404).json({ error: 'No Global snapshot found. Bootstrap GCAT first.' });
      return;
    }
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

globalCatalogRouter.get('/bootstrap/status', (_req, res) => {
  try {
    const conn = getDb();
    res.json(getGlobalBootstrapStatus(conn));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

globalCatalogRouter.post('/bootstrap', async (req, res) => {
  try {
    const conn = getDb();
    const force = req.query.force === 'true';
    const result = await runGlobalGcatBootstrap(conn, { force });
    if (!result.skipped && result.launch_rows_parsed && result.satellite_rows_parsed) {
      const snapshotId = computeAndSnapshotGlobal(conn, null);
      res.json({ ...result, snapshot_id: snapshotId });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

globalCatalogRouter.post('/update', async (_req, res) => {
  try {
    const conn = getDb();
    const result = await runGlobalUpdate(conn);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

globalCatalogRouter.get('/reviews', (_req, res) => {
  res.json({ reviews: [] });
});

globalCatalogRouter.post('/reviews/approve-all', (_req, res) => {
  res.json({ approved_ids: [], failed: [], approved_count: 0 });
});

globalCatalogRouter.post('/reviews/:id', (_req, res) => {
  res.json({ ok: true, status: 'approved' });
});

globalCatalogRouter.post('/publish/csv-download', async (_req, res) => {
  try {
    const conn = getDb();
    const zip = await buildGlobalCsvZip(conn);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="global-catalogue-csvs.zip"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(zip);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('No global catalog data')) {
      res.status(501).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

globalCatalogRouter.post('/publish', (_req, res) => {
  res.status(501).json({ error: 'API publish is not implemented for local global catalog' });
});
