import 'dotenv/config';

export const PORT = Number(process.env.PORT ?? 3002);

/** Space-Industry-Data-Pipeline FastAPI base URL (no trailing slash). */
export const PIPELINE_API_URL = (process.env.PIPELINE_API_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  ''
);

/** TTL for cached pipeline fleet snapshot (ms). Default 10 minutes. */
export const PIPELINE_CACHE_TTL_MS = Number(process.env.PIPELINE_CACHE_TTL_MS ?? 10 * 60_000);

/** CelesTrak TLE disk + memory cache TTL (ms). Default 8 hours. */
export const STARLINK_TLE_CACHE_TTL_MS = Number(
  process.env.STARLINK_TLE_CACHE_TTL_MS ?? 8 * 60 * 60 * 1000
);

/** On-disk Starlink TLE cache path. */
export const STARLINK_TLE_CACHE_PATH =
  process.env.STARLINK_TLE_CACHE_PATH ?? '.cache/starlink/tle.json';
