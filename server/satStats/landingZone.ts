import fs from 'node:fs';
import path from 'node:path';
import { SAT_STATS_LANDING_ZONE } from './config.js';
import type { SatStatsSourceId } from './types.js';

export function saveLandingArtifact(
  source: SatStatsSourceId,
  kind: string,
  body: string | Buffer,
  ext = 'json'
): string {
  const dir = path.join(SAT_STATS_LANDING_ZONE, source);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}_${kind}.${ext}`);
  fs.writeFileSync(file, body);
  return file;
}

export function listLandingArtifacts(source: SatStatsSourceId, limit = 20): string[] {
  const dir = path.join(SAT_STATS_LANDING_ZONE, source);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, limit);
}
