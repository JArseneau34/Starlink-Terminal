import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { clearCache } from './cache.js';
import { PORT } from './config.js';
import { documentIsolationHeaders } from './embed/orionFrame.js';
import { buildOrbitalPayload } from './services/orbital.js';
import {
  buildStarlinkPayload,
  getStarlinkCatalogStatus,
  getTrackedStarlinkCatalog,
  refreshStarlinkTle,
} from './services/orbitalStarlink.js';
import { clearStarlinkCatalogRuntimeCache, resolveStarlinkCatalog } from './services/starlinkCatalogFetch.js';
import { STARLINK_TLE_CACHE_TTL_MS } from './config.js';
import { buildStarlinkIntelPayload } from './services/orbitalStarlinkIntel.js';
import { satStatsRouter } from './satStats/routes.js';
import { globalCatalogRouter } from './globalCatalog/routes.js';
import { getDb } from './satStats/db.js';
import { seedStarlinkHistoryIfEmpty } from './satStats/seed.js';
import { computeAndSnapshot, getLatestSnapshot } from './satStats/snapshot.js';
import {
  getStarlinkSatelliteByNorad,
  searchStarlinkSatellites,
} from './services/orbitalStarlinkSatellite.js';
import {
  getWalkerFitPayload,
  updateAndPublishWalkerFit,
} from './walkerFit/orchestrator.js';

const app = express();

app.use(cors());
app.use(express.json());

/** COOP/COEP on standalone docs; skip for Orion iframe (`?embed=1` / Sec-Fetch-Dest). */
app.use((req, res, next) => {
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  const headers = documentIsolationHeaders({
    url: req.originalUrl || req.url,
    headers: req.headers as { [key: string]: unknown },
  });
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'starlink-orbital-ops', timestamp: new Date().toISOString() });
});

app.get('/api/orbital', async (_req, res) => {
  try {
    const payload = await buildOrbitalPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to build orbital payload',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink', async (_req, res) => {
  try {
    const payload = await buildStarlinkPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to build Starlink catalog',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink/status', async (_req, res) => {
  try {
    const catalog = await getTrackedStarlinkCatalog();
    res.json(getStarlinkCatalogStatus(catalog));
  } catch (err) {
    res.status(500).json({
      error: 'Failed to read Starlink catalog status',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink/intel', async (_req, res) => {
  try {
    const payload = await buildStarlinkIntelPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to build Starlink intel',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink/sat/:noradId', async (req, res) => {
  const noradId = Number(req.params.noradId);
  if (!Number.isFinite(noradId) || noradId <= 0) {
    res.status(400).json({ error: 'Invalid NORAD catalog ID' });
    return;
  }

  try {
    const detail = await getStarlinkSatelliteByNorad(noradId);
    if (!detail) {
      res.status(404).json({ error: 'Starlink satellite not found' });
      return;
    }
    res.json(detail);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch satellite detail',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink/search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  try {
    const results = await searchStarlinkSatellites(query, 10);
    res.json({ query, results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to search Starlink catalog',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/api/orbital/starlink/walker-fit', async (_req, res) => {
  try {
    const payload = await getWalkerFitPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to build Walker fit feed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.post('/api/orbital/starlink/walker-fit/refresh', async (_req, res) => {
  try {
    const payload = await updateAndPublishWalkerFit();
    res.json({
      ok: true,
      walkerReferenceTotal: payload.walkerReferenceTotal,
      grantedSlotTotal: payload.grantedSlotTotal,
      transitCount: payload.transitCount,
      shells: payload.shells.length,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to refresh Walker fit feed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.use('/api/sat-stats', satStatsRouter);
app.use('/api/global-catalog', globalCatalogRouter);

app.post('/api/refresh', (_req, res) => {
  clearCache();
  clearStarlinkCatalogRuntimeCache();
  void resolveStarlinkCatalog({ forceRefresh: true })
    .then((catalog) => {
      console.log(
        `[starlink] async catalog refresh complete (${catalog.source}, ${catalog.count} sats, offline=${catalog.offline})`
      );
    })
    .catch((err) => {
      console.warn(
        '[starlink] async catalog refresh failed:',
        err instanceof Error ? err.message : err
      );
    });
  res.json({ ok: true, message: 'Cache cleared — catalog refresh started in background' });
});

/** Production: Vite `dist` at `/` (not `/constellation/`). `/?embed=1` is the Orion iframe. */
const serveWeb = process.env.SERVE_WEB === '1' || process.env.SERVE_WEB === 'true';
if (serveWeb) {
  const distDir = path.resolve(process.env.DIST_DIR ?? 'dist');
  const publicDir = path.resolve(process.env.PUBLIC_DIR ?? 'public');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      res.status(404).json({ error: 'UI not built — run npm run build or unset SERVE_WEB' });
      return;
    }
    res.sendFile(indexHtml);
  });
}

const server = http.createServer(app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[api] Port ${PORT} already in use — another API instance may be running`);
    process.exit(0);
    return;
  }
  console.error('[api] Server error:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Starlink orbital API on http://localhost:${PORT}`);
  try {
    const conn = getDb();
    const seeded = seedStarlinkHistoryIfEmpty(conn);
    if (seeded) console.log(`[sat-stats] Seeded ${seeded} historical fleet rows`);
    if (!getLatestSnapshot(conn)) {
      const snapshotId = computeAndSnapshot(conn);
      console.log(`[sat-stats] Initial compute snapshot #${snapshotId}`);
    }
  } catch (err) {
    console.warn('[sat-stats] Startup init skipped:', err instanceof Error ? err.message : err);
  }
  void refreshStarlinkTle().then(() => {
    void updateAndPublishWalkerFit().catch((err) => {
      console.warn('[walker-fit] Initial publish failed:', err instanceof Error ? err.message : err);
    });
  });
  setInterval(() => {
    void refreshStarlinkTle().then(() => {
      void updateAndPublishWalkerFit().catch((err) => {
        console.warn('[walker-fit] Publish failed:', err instanceof Error ? err.message : err);
      });
    });
  }, STARLINK_TLE_CACHE_TTL_MS * 0.9);
});
