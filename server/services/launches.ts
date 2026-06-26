import { getCached, setCache } from '../cache.js';
import { CACHE_TTL, LL2_API_KEY, LL2_BASE } from '../config.js';
import type { DataSourceStatus, Launch } from '../types.js';
import { getFallbackLaunches } from './launchFallback.js';

const LAUNCHES_CACHE_KEY = 'launches';
const USER_AGENT = 'SPCX-Terminal/1.0';
const PROD_LL2 = 'https://ll.thespacedevs.com/2.3.0';
const DEV_LL2 = 'https://lldev.thespacedevs.com/2.3.0';

interface LL2Launch {
  id: string;
  name: string;
  net: string;
  probability?: number | null;
  status?: { name: string; abbrev: string };
  launch_service_provider?: { name: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: { name?: string; location?: { name?: string } };
  mission?: { description?: string };
}

interface LL2Response {
  count: number;
  results: LL2Launch[];
}

export interface LaunchFetchResult {
  launches: Launch[];
  upcomingCount: number;
  ytdCount: number;
  status: DataSourceStatus;
}

function ll2Headers(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
  if (LL2_API_KEY) {
    headers.Authorization = `Bearer ${LL2_API_KEY}`;
  }
  return headers;
}

async function fetchLL2FromBase<T>(base: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: ll2Headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchLL2<T>(path: string): Promise<{ data: T | null; source: string }> {
  const bases = LL2_API_KEY
    ? [LL2_BASE, PROD_LL2, DEV_LL2]
    : [DEV_LL2, PROD_LL2, LL2_BASE];
  const uniqueBases = bases.filter((b, i, arr) => arr.indexOf(b) === i);

  for (const base of uniqueBases) {
    const data = await fetchLL2FromBase<T>(base, path);
    if (data) {
      const label = base.includes('lldev') ? 'LL2 Dev' : 'Launch Library 2';
      return { data, source: label };
    }
  }

  return { data: null, source: 'Launch Library 2' };
}

function mapLaunch(l: LL2Launch): Launch {
  const rocket =
    l.rocket?.configuration?.full_name ??
    l.rocket?.configuration?.name ??
    'Unknown';
  const padName = l.pad?.name ?? 'TBD';
  const rangeName = l.pad?.location?.name ?? 'TBD';
  const location = rangeName !== 'TBD' ? `${padName}, ${rangeName}` : padName;

  return {
    id: l.id,
    name: l.name,
    provider: l.launch_service_provider?.name ?? 'Unknown',
    rocket,
    location,
    pad: padName,
    range: rangeName,
    date: l.net,
    status: l.status?.name ?? 'TBD',
    mission: l.mission?.description?.slice(0, 150),
    probability: l.probability ?? null,
  };
}

export async function fetchLaunches(): Promise<LaunchFetchResult> {
  const year = new Date().getFullYear();
  const upcomingPath = '/launches/upcoming/?limit=50&hide_recent_previous=true&ordering=net';
  const ytdPath = `/launches/?net__gte=${year}-01-01T00:00:00Z&limit=1`;

  const [upcomingResult, ytdResult] = await Promise.all([
    fetchLL2<LL2Response>(upcomingPath),
    fetchLL2<LL2Response>(ytdPath),
  ]);

  const upcoming = upcomingResult.data;
  const ytdMeta = ytdResult.data;

  if (upcoming?.results?.length) {
    const result: LaunchFetchResult = {
      launches: upcoming.results.map(mapLaunch),
      upcomingCount: upcoming.count,
      ytdCount: ytdMeta?.count ?? 0,
      status: {
        name: upcomingResult.source,
        status: 'ok',
        lastFetch: new Date().toISOString(),
        message: `${upcoming.count} upcoming · ${ytdMeta?.count ?? '?'} YTD orbital`,
      },
    };
    setCache(LAUNCHES_CACHE_KEY, result, CACHE_TTL.launches);
    return result;
  }

  const stale = getCached<LaunchFetchResult>(LAUNCHES_CACHE_KEY);
  if (stale?.launches.length) {
    return {
      ...stale,
      status: {
        name: stale.status.name,
        status: 'cached',
        lastFetch: stale.status.lastFetch,
        message: 'LL2 rate-limited — serving cached departures',
      },
    };
  }

  const fallback = getFallbackLaunches();
  return {
    launches: fallback,
    upcomingCount: fallback.length,
    ytdCount: ytdMeta?.count ?? 0,
    status: {
      name: 'Launch schedule',
      status: 'seed',
      lastFetch: new Date().toISOString(),
      message: 'LL2 unavailable — synthetic manifest schedule',
    },
  };
}
