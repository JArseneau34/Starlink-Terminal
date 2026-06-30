/**
 * CelesTrak → shell bucket → real counts.
 *
 * Single entry point for live Starlink catalog ingest. Shell counts are always
 * derived from fetched TLE inclination — never hardcoded. When CelesTrak is
 * unreachable, falls back to disk then in-memory stale cache.
 */

import { coalesceAsync, getCached, setCache } from '../cache.js';
import { STARLINK_TLE_CACHE_TTL_MS } from '../config.js';
import {
  buildCatalogShells,
  type StarlinkCatalogShell,
} from '../../src/data/starlinkShellBands.ts';
import { classifyVisualShell, type StarlinkModelHint } from '../../src/data/starlinkVisualShells.ts';
import type { StarlinkLifecycle } from '../../src/data/starlinkOrbitOmm.ts';
import {
  isTleCacheFresh,
  loadTleDiskCache,
  saveTleDiskCache,
  type StarlinkOmmRecord,
  type StarlinkTleSource,
  type StoredTleSat,
} from './starlinkTleStore.js';
import { fetchStarlinkOmmFromTleApi } from './starlinkTleApiFallback.js';

export type { StarlinkOmmRecord, StarlinkTleSource } from './starlinkTleStore.js';

const CELESTRAK_URLS: { url: string; source: Exclude<StarlinkTleSource, 'cache'> }[] = [
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=JSON',
    source: 'group',
  },
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=JSON',
    source: 'name',
  },
];
const CELESTRAK_HEADERS = { 'User-Agent': 'SPCX-Terminal/1.0' };
const MEM_CACHE_KEY = 'starlink:tle:v1';
const FETCH_COALESCE_KEY = 'starlink:tle:fetch';

/** Satellite after visual-shell classification — distinct from Walker topology shells. */
export interface BucketedStarlinkSat {
  omm: StarlinkOmmRecord;
  shell: number;
  lifecycle: StarlinkLifecycle;
  modelHint: StarlinkModelHint;
}

export interface StarlinkCatalogBucketResult {
  /** Bucketed TLE rows — count equals sum(shells[].count). */
  sats: BucketedStarlinkSat[];
  /** Per-shell counts derived from sats — self-correcting on every fetch. */
  shells: StarlinkCatalogShell[];
  count: number;
  source: StarlinkTleSource;
  fetchedAt: number;
  /** True when CelesTrak was unreachable and a stale cache was served. */
  offline: boolean;
}

interface CatalogCacheEntry {
  sats: BucketedStarlinkSat[];
  shells: StarlinkCatalogShell[];
  count: number;
  source: StarlinkTleSource;
  fetchedAt: number;
}

let memoryCatalog: CatalogCacheEntry | null = null;

export function clearStarlinkCatalogRuntimeCache(): void {
  memoryCatalog = null;
}

/** Classify each OMM row into a visual shell (not Walker topology). */
export function bucketOmmRecords(records: readonly StarlinkOmmRecord[]): BucketedStarlinkSat[] {
  const sats: BucketedStarlinkSat[] = [];
  for (const omm of records) {
    if (!omm.NORAD_CAT_ID || !omm.EPOCH) continue;
    const assignment = classifyVisualShell(omm);
    sats.push({
      omm,
      shell: assignment.shellIndex,
      lifecycle: assignment.lifecycle,
      modelHint: assignment.modelHint,
    });
  }
  return sats;
}

/** Build shell summary with real counts from bucketed satellites. */
export function shellsFromBucketed(sats: readonly BucketedStarlinkSat[]): StarlinkCatalogShell[] {
  return buildCatalogShells(sats.map((sat) => sat.shell));
}

function toCacheEntry(
  sats: BucketedStarlinkSat[],
  source: StarlinkTleSource,
  fetchedAt: number
): CatalogCacheEntry {
  const shells = shellsFromBucketed(sats);
  return {
    sats,
    shells,
    count: sats.length,
    source,
    fetchedAt,
  };
}

function toStoredSats(sats: BucketedStarlinkSat[]): StoredTleSat[] {
  return sats.map(({ omm }) => ({ omm }));
}

function fromStoredSats(stored: StoredTleSat[]): BucketedStarlinkSat[] {
  return stored.map(({ omm }) => {
    const assignment = classifyVisualShell(omm);
    return {
      omm,
      shell: assignment.shellIndex,
      lifecycle: assignment.lifecycle,
      modelHint: assignment.modelHint,
    };
  });
}

function toBucketResult(entry: CatalogCacheEntry, offline: boolean): StarlinkCatalogBucketResult {
  return { ...entry, offline };
}

/** Invariant: total count must equal sum of per-shell counts. */
export function assertShellCountInvariant(result: Pick<StarlinkCatalogBucketResult, 'count' | 'shells'>): void {
  const sum = result.shells.reduce((total, sh) => total + sh.count, 0);
  if (sum !== result.count) {
    throw new Error(`shell count invariant failed: count=${result.count} sum(shells)=${sum}`);
  }
}

export async function fetchStarlinkOmmFromCelesTrak(): Promise<{
  records: StarlinkOmmRecord[];
  source: Exclude<StarlinkTleSource, 'cache'>;
}> {
  let lastError: unknown = null;

  for (const { url, source } of CELESTRAK_URLS) {
    try {
      const res = await fetch(url, {
        headers: CELESTRAK_HEADERS,
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 403) {
        lastError = new Error(`CelesTrak ${source} fetch returned 403`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`CelesTrak ${source} fetch failed: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as StarlinkOmmRecord[];
      if (!Array.isArray(data) || data.length === 0) {
        lastError = new Error(`CelesTrak ${source} returned empty catalog`);
        continue;
      }
      console.log(`[starlink] CelesTrak ${source} catalog: ${data.length} satellites`);
      return { records: data, source };
    } catch (err) {
      lastError = err;
    }
  }

  // CelesTrak unreachable (blocked/timeout) — fall back to the reachable TLE API mirror.
  try {
    const records = await fetchStarlinkOmmFromTleApi();
    console.log(`[starlink] TLE API fallback catalog: ${records.length} satellites`);
    return { records, source: 'tleapi' };
  } catch (err) {
    lastError = err;
  }

  throw lastError instanceof Error ? lastError : new Error('CelesTrak Starlink fetch failed');
}

function persistCatalog(entry: CatalogCacheEntry): CatalogCacheEntry {
  memoryCatalog = entry;
  saveTleDiskCache({
    fetchedAt: entry.fetchedAt,
    source: entry.source,
    sats: toStoredSats(entry.sats),
  });
  setCache(MEM_CACHE_KEY, entry, STARLINK_TLE_CACHE_TTL_MS);
  assertShellCountInvariant(entry);
  return entry;
}

/**
 * A fresh fetch should never be a small fraction of a known-good cached catalog.
 * A sudden collapse means a truncated/rate-limited upstream response, not a real
 * fleet change — reject it so we keep serving the larger cache.
 */
const CATALOG_COLLAPSE_FLOOR = 0.5;

function assertNotCollapsedCatalog(newCount: number, source: StarlinkTleSource): void {
  const prevCount = memoryCatalog?.count ?? loadTleDiskCache()?.sats.length ?? 0;
  if (prevCount > 0 && newCount < prevCount * CATALOG_COLLAPSE_FLOOR) {
    throw new Error(
      `catalog collapse guard: ${source} returned ${newCount} sats vs ${prevCount} cached ` +
        `(< ${Math.round(CATALOG_COLLAPSE_FLOOR * 100)}%) — keeping cached catalog`
    );
  }
}

function ingestOmmRecords(
  records: StarlinkOmmRecord[],
  source: StarlinkTleSource
): CatalogCacheEntry {
  const sats = bucketOmmRecords(records);
  assertNotCollapsedCatalog(sats.length, source);
  return persistCatalog(toCacheEntry(sats, source, Date.now()));
}

function loadFreshDiskCatalog(): CatalogCacheEntry | null {
  const disk = loadTleDiskCache();
  if (!disk || !isTleCacheFresh(disk)) return null;
  const sats = fromStoredSats(disk.sats);
  if (!sats.length) return null;
  const entry = toCacheEntry(sats, disk.source, disk.fetchedAt);
  memoryCatalog = entry;
  return entry;
}

function loadStaleDiskCatalog(): CatalogCacheEntry | null {
  const disk = loadTleDiskCache();
  if (!disk?.sats.length) return null;
  const sats = fromStoredSats(disk.sats);
  if (!sats.length) return null;
  return toCacheEntry(sats, 'cache', disk.fetchedAt);
}

/**
 * Resolve the live Starlink catalog: memory → fresh disk → CelesTrak → stale fallback.
 */
export async function resolveStarlinkCatalog(options?: {
  forceRefresh?: boolean;
}): Promise<StarlinkCatalogBucketResult> {
  if (!options?.forceRefresh && memoryCatalog && isTleCacheFresh(memoryCatalog)) {
    return toBucketResult(memoryCatalog, false);
  }

  if (!options?.forceRefresh) {
    const memCached = getCached<CatalogCacheEntry>(MEM_CACHE_KEY);
    if (memCached && isTleCacheFresh(memCached)) {
      memoryCatalog = memCached;
      return toBucketResult(memCached, false);
    }

    const diskEntry = loadFreshDiskCatalog();
    if (diskEntry) {
      return toBucketResult(diskEntry, false);
    }
  }

  return coalesceAsync(FETCH_COALESCE_KEY, async () => {
    try {
      const { records, source } = await fetchStarlinkOmmFromCelesTrak();
      const entry = ingestOmmRecords(records, source);
      console.log(
        `[starlink] bucketed ${entry.count} sats: ${entry.shells.map((sh) => `${sh.name}=${sh.count}`).join(', ')}`
      );
      return toBucketResult(entry, false);
    } catch (err) {
      if (memoryCatalog?.sats.length) {
        console.warn('[starlink] CelesTrak fetch failed — serving in-memory stale catalog');
        return toBucketResult(memoryCatalog, true);
      }
      const staleDisk = loadStaleDiskCatalog();
      if (staleDisk) {
        console.warn('[starlink] CelesTrak fetch failed — serving disk stale catalog');
        memoryCatalog = staleDisk;
        return toBucketResult(staleDisk, true);
      }
      throw err;
    }
  });
}

/** Proactive CelesTrak refresh before TLE cache expires. */
export async function refreshStarlinkCatalog(): Promise<StarlinkCatalogBucketResult | null> {
  try {
    if (memoryCatalog && isTleCacheFresh(memoryCatalog, STARLINK_TLE_CACHE_TTL_MS * 0.95)) {
      return toBucketResult(memoryCatalog, false);
    }
    const { records, source } = await fetchStarlinkOmmFromCelesTrak();
    const entry = ingestOmmRecords(records, source);
    console.log(`[starlink] background catalog refresh complete (${source}, ${entry.count} sats)`);
    return toBucketResult(entry, false);
  } catch (err) {
    console.warn(
      '[starlink] background catalog refresh failed:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export function getStarlinkCatalogBucketStatus(
  catalog: Pick<StarlinkCatalogBucketResult, 'sats' | 'shells' | 'count' | 'fetchedAt' | 'source'>
): {
  count: number;
  tleFetchedAt: string;
  tleExpiresAt: string;
  source: StarlinkTleSource;
  shells: StarlinkCatalogShell[];
} {
  return {
    count: catalog.count,
    tleFetchedAt: new Date(catalog.fetchedAt).toISOString(),
    tleExpiresAt: new Date(catalog.fetchedAt + STARLINK_TLE_CACHE_TTL_MS).toISOString(),
    source: catalog.source,
    shells: catalog.shells,
  };
}
