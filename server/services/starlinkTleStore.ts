import fs from 'node:fs';
import path from 'node:path';
import { STARLINK_TLE_CACHE_PATH, STARLINK_TLE_CACHE_TTL_MS } from '../config.js';

export type StarlinkTleSource = 'group' | 'name' | 'tleapi' | 'cache';

export interface StarlinkOmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  INCLINATION: number;
  ECCENTRICITY?: number;
  BSTAR?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  ELEMENT_SET_NO?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
}

export interface StoredTleSat {
  omm: StarlinkOmmRecord;
  /** Legacy disk cache field — ignored; shell is re-derived on load. */
  shell?: number;
}

export interface StarlinkTleDiskEntry {
  fetchedAt: number;
  source: StarlinkTleSource;
  sats: StoredTleSat[];
}

function cacheDir(): string {
  return path.dirname(STARLINK_TLE_CACHE_PATH);
}

export function isTleCacheFresh(
  entry: Pick<StarlinkTleDiskEntry, 'fetchedAt'>,
  ttlMs: number = STARLINK_TLE_CACHE_TTL_MS
): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

export function loadTleDiskCache(): StarlinkTleDiskEntry | null {
  try {
    if (!fs.existsSync(STARLINK_TLE_CACHE_PATH)) return null;
    const raw = fs.readFileSync(STARLINK_TLE_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StarlinkTleDiskEntry;
    if (!parsed?.sats?.length || !Number.isFinite(parsed.fetchedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTleDiskCache(entry: StarlinkTleDiskEntry): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(STARLINK_TLE_CACHE_PATH, JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn('[starlink] failed to write TLE disk cache:', err);
  }
}
