/**
 * Fallback Starlink TLE source for when CelesTrak is unreachable.
 *
 * Uses the public tle.ivanstanojevic.me mirror (CelesTrak-derived GP data) and
 * converts each two-line element set into the same OMM record shape produced by
 * the CelesTrak GP JSON feed, so the downstream bucket/propagation pipeline is
 * unchanged. Propagation parity with twoline2satrec is exact (sub-meter).
 *
 * The mirror rate-limits aggressive paging (HTTP 429). To avoid silently caching
 * a truncated catalog (which previously dropped thousands of satellites), this
 * module: (a) retries pages with backoff honouring Retry-After, (b) paginates with
 * low concurrency and inter-batch spacing, and (c) refuses to return a result that
 * is materially short of the mirror's reported totalItems.
 */

import type { StarlinkOmmRecord } from './starlinkTleStore.js';

// Use HTTP here intentionally: the mirror redirects to HTTPS, but this avoids
// Node's bundled CA store rejecting the mirror certificate in local dev when
// tsx spawns a child process without --use-system-ca.
const TLE_API_BASE = 'http://tle.ivanstanojevic.me/api/tle/';
const TLE_API_PAGE_SIZE = 100;
const TLE_API_MAX_PAGES = 250;
/** Low concurrency + spacing keeps us under the mirror's rate limit. */
const TLE_API_CONCURRENCY = 2;
const TLE_API_BATCH_DELAY_MS = 300;
const TLE_API_MAX_RETRIES = 5;
/**
 * Reject obviously truncated mirror fetches. The mirror's search total includes
 * non-Starlink names, so the Starlink-only subset is normally well below 90%.
 */
const TLE_API_MIN_COMPLETENESS = 0.6;
const TLE_API_HEADERS = { 'User-Agent': 'SPCX-Terminal/1.0', Accept: 'application/json' };

interface TleApiMember {
  satelliteId: number;
  name: string;
  date?: string;
  line1: string;
  line2: string;
}

interface TleApiPage {
  totalItems?: number;
  member?: TleApiMember[];
}

/** Thrown when the mirror returns fewer Starlink records than it reports as available. */
export class TleApiIncompleteError extends Error {
  constructor(
    readonly collected: number,
    readonly expected: number,
    readonly failedPages: number
  ) {
    super(
      `TLE API catalog incomplete: collected ${collected} of ${expected} ` +
        `(${failedPages} page(s) failed after retries) — refusing to cache a truncated catalog`
    );
    this.name = 'TleApiIncompleteError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt: number): number {
  return Math.min(10_000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

/** Parse a TLE assumed-decimal exponential field (e.g. " 11802-3" → 0.00011802). */
function parseExpDecimal(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const sign = s[0] === '-' ? -1 : 1;
  const core = s.replace(/^[+-]/, '');
  const match = core.match(/^(\d+)([+-]\d)$/);
  if (!match) return sign * Number(`0.${core}`);
  return sign * Number(`0.${match[1]}`) * Math.pow(10, Number(match[2]));
}

function epochIsoFromLine1(line1: string): string {
  const epochYr = Number(line1.slice(18, 20));
  const epochDay = Number(line1.slice(20, 32));
  const year = epochYr < 57 ? 2000 + epochYr : 1900 + epochYr;
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCMilliseconds((epochDay - 1) * 86_400_000);
  return date.toISOString();
}

function objectIdFromLine1(line1: string): string | null {
  const intl = line1.slice(9, 17).trim();
  if (!intl) return null;
  const yy = Number(intl.slice(0, 2));
  if (!Number.isFinite(yy)) return null;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return `${year}-${intl.slice(2).trim()}`;
}

/** Convert a TLE line pair into the CelesTrak-compatible OMM record shape. */
export function tleToOmmRecord(name: string, line1: string, line2: string): StarlinkOmmRecord | null {
  if (line1.length < 68 || line2.length < 63) return null;
  const noradId = Number(line1.slice(2, 7));
  const meanMotion = Number(line2.slice(52, 63));
  const inclination = Number(line2.slice(8, 16));
  if (!Number.isFinite(noradId) || !Number.isFinite(meanMotion) || !Number.isFinite(inclination)) {
    return null;
  }
  return {
    OBJECT_NAME: name,
    OBJECT_ID: objectIdFromLine1(line1) ?? undefined,
    NORAD_CAT_ID: noradId,
    EPOCH: epochIsoFromLine1(line1),
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: Number(`0.${line2.slice(26, 33).trim()}`),
    INCLINATION: inclination,
    RA_OF_ASC_NODE: Number(line2.slice(17, 25)),
    ARG_OF_PERICENTER: Number(line2.slice(34, 42)),
    MEAN_ANOMALY: Number(line2.slice(43, 51)),
    MEAN_MOTION_DOT: Number(line1.slice(33, 43)),
    MEAN_MOTION_DDOT: parseExpDecimal(line1.slice(44, 52)),
    BSTAR: parseExpDecimal(line1.slice(53, 61)),
    ELEMENT_SET_NO: Number(line1.slice(64, 68)),
  };
}

/**
 * Fetch one page, retrying on 429 / 5xx with backoff (honouring Retry-After).
 * Throws if the page cannot be retrieved after all retries — the caller treats
 * that as a hard failure rather than silently dropping the page's satellites.
 */
async function fetchTleApiPage(page: number): Promise<TleApiPage> {
  const url = `${TLE_API_BASE}?search=starlink&page-size=${TLE_API_PAGE_SIZE}&page=${page}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= TLE_API_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: TLE_API_HEADERS,
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429 || res.status >= 500) {
        const retryAfterRaw = Number(res.headers.get('retry-after'));
        const waitMs =
          Number.isFinite(retryAfterRaw) && retryAfterRaw > 0
            ? retryAfterRaw * 1000
            : backoffDelayMs(attempt);
        lastError = new Error(`TLE API page ${page} status ${res.status}`);
        if (attempt < TLE_API_MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        break;
      }

      if (!res.ok) {
        throw new Error(`TLE API page ${page} failed: ${res.status}`);
      }
      return (await res.json()) as TleApiPage;
    } catch (err) {
      lastError = err;
      if (attempt < TLE_API_MAX_RETRIES) {
        await sleep(backoffDelayMs(attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`TLE API page ${page} failed after ${TLE_API_MAX_RETRIES} retries`);
}

/**
 * Fetch the full Starlink catalog from the TLE API mirror and convert to OMM.
 *
 * Pages are fetched in small bounded-concurrency batches with spacing to stay
 * under the mirror's rate limit. Any page that cannot be retrieved after retries
 * counts as a failed page; if pages fail or the collected total falls short of the
 * reported totalItems, the whole fetch is rejected so a truncated catalog is never
 * cached or served.
 */
export async function fetchStarlinkOmmFromTleApi(): Promise<StarlinkOmmRecord[]> {
  const firstPage = await fetchTleApiPage(1);
  const total = firstPage.totalItems ?? firstPage.member?.length ?? 0;
  const pageCount = Math.min(
    TLE_API_MAX_PAGES,
    Math.max(1, Math.ceil(total / TLE_API_PAGE_SIZE))
  );

  const pages: TleApiPage[] = [firstPage];
  let failedPages = 0;

  for (let start = 2; start <= pageCount; start += TLE_API_CONCURRENCY) {
    const batch: Promise<TleApiPage>[] = [];
    for (let p = start; p < start + TLE_API_CONCURRENCY && p <= pageCount; p++) {
      batch.push(
        fetchTleApiPage(p).catch((err) => {
          failedPages++;
          console.warn(
            `[starlink] TLE API page ${p} failed after retries:`,
            err instanceof Error ? err.message : err
          );
          return { member: [] } as TleApiPage;
        })
      );
    }
    pages.push(...(await Promise.all(batch)));
    if (start + TLE_API_CONCURRENCY <= pageCount) {
      await sleep(TLE_API_BATCH_DELAY_MS);
    }
  }

  const records: StarlinkOmmRecord[] = [];
  const seen = new Set<number>();
  for (const page of pages) {
    for (const member of page.member ?? []) {
      const name = member.name?.toUpperCase() ?? '';
      if (!name.startsWith('STARLINK')) continue;
      if (seen.has(member.satelliteId)) continue;
      const omm = tleToOmmRecord(member.name, member.line1, member.line2);
      if (!omm) continue;
      seen.add(member.satelliteId);
      records.push(omm);
    }
  }

  if (records.length === 0) {
    throw new Error('TLE API returned no Starlink records');
  }

  // Guard against silently caching a rate-limited / truncated catalog. The mirror
  // search includes non-Starlink names, so totalItems is an upper bound — only the
  // completeness ratio (and any hard page failures) gate acceptance.
  if (total > 0) {
    const completeness = records.length / total;
    if (failedPages > 0 || completeness < TLE_API_MIN_COMPLETENESS) {
      throw new TleApiIncompleteError(records.length, total, failedPages);
    }
  }

  return records;
}
