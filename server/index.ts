import http from 'http';
import express from 'express';
import cors from 'cors';
import { clearCache } from './cache.js';
import { PORT } from './config.js';
import { buildOrbitalPayload } from './services/orbital.js';
import { buildStarlinkPayload } from './services/orbitalStarlink.js';
import { buildStarlinkIntelPayload } from './services/orbitalStarlinkIntel.js';
import {
  getStarlinkSatelliteByNorad,
  searchStarlinkSatellites,
} from './services/orbitalStarlinkSatellite.js';

const app = express();

app.use(cors());
app.use(express.json());

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

app.post('/api/refresh', (_req, res) => {
  clearCache();
  res.json({ ok: true, message: 'Cache cleared' });
});

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
});
