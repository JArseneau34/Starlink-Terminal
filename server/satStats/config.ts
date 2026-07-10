import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SAT_STATS_DB_PATH =
  process.env.SAT_STATS_DB_PATH ?? path.join(root, '.cache', 'sat-stats', 'sat_stats.db');

export const SAT_STATS_LANDING_ZONE =
  process.env.SAT_STATS_LANDING_ZONE ?? path.join(root, '.cache', 'sat-stats', 'landing');

export const SAT_STATS_EXPORTS_DIR =
  process.env.SAT_STATS_EXPORTS_DIR ?? path.join(root, '.cache', 'sat-stats', 'exports');

export const SAT_STATS_LAYER1_DIR =
  process.env.SAT_STATS_LAYER1_DIR ?? path.join(root, '.cache', 'sat-stats', 'layer1_raw');

export const SAT_STATS_PUBLIC_DIR = path.join(root, 'public', 'sat-stats');

export const HISTORICAL_STARLINK_SEED_CSV = path.join(
  root,
  'data',
  'seeds',
  'Historical_Starlink_Scraper_Log.csv'
);

export const SPACETRACK_USER = process.env.SPACETRACK_USER ?? '';
export const SPACETRACK_PASSWORD = process.env.SPACETRACK_PASSWORD ?? '';

export const LL2_API_URL =
  process.env.LL2_API_URL ?? 'https://ll.thespacedevs.com/2.3.0';
export const LL2_API_KEY = process.env.LL2_API_KEY ?? '';

export const FCC_ECFS_API =
  process.env.FCC_ECFS_API ?? 'https://publicapi.fcc.gov/ecfs/filings';

export const FCC_SEARCH_TERMS = (process.env.FCC_SEARCH_TERMS ?? 'Starlink,SpaceX constellation')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const MCDOWELL_STARLINK_STATS_URL =
  process.env.MCDOWELL_STARLINK_STATS_URL ??
  'https://planet4589.org/space/con/star/stats.html';

export const SAT_STATS_USER_AGENT =
  process.env.SAT_STATS_USER_AGENT ?? 'SatStats-Terminal/1.0 (space industry aggregation; contact: local-dev)';

export const SAT_STATS_FETCH_TIMEOUT_MS = Number(process.env.SAT_STATS_FETCH_TIMEOUT_MS ?? 45_000);
