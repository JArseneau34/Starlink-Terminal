import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const GCAT_LAUNCH_URL = 'https://planet4589.org/space/gcat/tsv/launch/launch.tsv';
export const GCAT_SATCAT_URL = 'https://planet4589.org/space/gcat/tsv/cat/satcat.tsv';

export const GLOBAL_CATALOG_DB_PATH =
  process.env.GLOBAL_CATALOG_DB_PATH ?? path.join(root, '.cache', 'global-catalog', 'global_catalog.db');

export const GCAT_LANDING_DIR =
  process.env.GCAT_LANDING_DIR ?? path.join(root, '.cache', 'global-catalog', 'landing');

export const GLOBAL_CATALOG_USER_AGENT =
  process.env.GLOBAL_CATALOG_USER_AGENT ?? 'Starlink-Terminal/1.0 (GCAT ingest; local-dev)';

export const GCAT_FETCH_TIMEOUT_MS = Number(process.env.GCAT_FETCH_TIMEOUT_MS ?? 120_000);

/** McDowell publishes ~7.5k launches and ~60k+ objects (2026). */
export const MIN_LAUNCH_BYTES = 900_000;
export const MIN_SATCAT_BYTES = 4_000_000;
export const MIN_LAUNCH_ROWS = 5_000;
export const MIN_SATCAT_ROWS = 40_000;

export const BOOTSTRAP_FLAG_GCAT = 'gcat_global_catalog';
