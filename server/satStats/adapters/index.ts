import { LL2_API_KEY, LL2_API_URL, MCDOWELL_STARLINK_STATS_URL } from '../config.js';
import { saveLandingArtifact } from '../landingZone.js';
import { satStatsFetchJson, satStatsFetchText } from '../http.js';
import type { AdapterFetchResult, LaunchArchiveRow } from '../types.js';
import { stableHash } from '../hash.js';
import { parseMcdowellSnapshotHtml } from './mcdowell.js';
import { scrapeHistoricalWikipediaLaunches, scrapeWikipediaLaunches } from './wikipediaBootstrap.js';

interface Ll2Launch {
  id?: string;
  name?: string;
  net?: string;
  status?: { name?: string };
  rocket?: { configuration?: { full_name?: string; family?: string } };
  pad?: { location?: { name?: string } };
  mission?: { description?: string; type?: string };
  launch_service_provider?: { name?: string };
}

interface Ll2Response {
  results?: Ll2Launch[];
  next?: string | null;
}

function mapLl2Launch(launch: Ll2Launch): LaunchArchiveRow | null {
  if (!launch.net) return null;
  const date = launch.net.slice(0, 10);
  const rocket = launch.rocket?.configuration?.full_name ?? launch.rocket?.configuration?.family ?? 'Unknown';
  let vehicle = 'Falcon 9';
  const rl = rocket.toLowerCase();
  if (rl.includes('heavy')) vehicle = 'Falcon Heavy';
  if (rl.includes('starship')) vehicle = 'Starship';
  const payloadText = launch.name ?? launch.mission?.description ?? '';
  const pt = payloadText.toLowerCase();
  let payloadType = 'Customer';
  if (pt.includes('starlink')) payloadType = 'Starlink';
  else if (pt.includes('crew dragon') || pt.includes('crew-')) payloadType = 'Dragon Crew';
  else if (pt.includes('crs-') || pt.includes('cargo dragon')) payloadType = 'Dragon Cargo';

  const row: LaunchArchiveRow = {
    flight_no: `LL2-${launch.id ?? launch.name ?? date}`,
    date_utc: date,
    vehicle,
    booster: null,
    ship: null,
    launch_site: launch.pad?.location?.name ?? null,
    payload_type: payloadType,
    payload: payloadText || null,
    payload_mass_kg: null,
    orbit: null,
    customer: launch.launch_service_provider?.name ?? null,
    launch_outcome: launch.status?.name ?? null,
    booster_landing: 'No attempt',
    number_of_starlink_satellites: payloadType === 'Starlink' ? 0 : null,
    starlink_model: payloadType === 'Starlink' ? 'v2 mini' : null,
    of_which_dtc: 0,
    description: launch.mission?.description?.slice(0, 500) ?? null,
    source_id: 'launch_library_2',
  };
  row.source_hash = stableHash(row);
  return row;
}

export async function fetchLaunchLibrary2(): Promise<AdapterFetchResult> {
  const notes: string[] = [];
  const launches: LaunchArchiveRow[] = [];
  try {
    const headers: Record<string, string> = {};
    if (LL2_API_KEY) headers.Authorization = `Token ${LL2_API_KEY}`;
    let url: string | null = `${LL2_API_URL}/launches/?provider__id=spacex&limit=100&ordering=-net`;
    let pages = 0;
    while (url && pages < 5) {
      const page: Ll2Response = await satStatsFetchJson<Ll2Response>(url, { headers });
      saveLandingArtifact('launch_library_2', `page_${pages}`, JSON.stringify(page, null, 2));
      for (const item of page.results ?? []) {
        const row = mapLl2Launch(item);
        if (row) launches.push(row);
      }
      url = page.next ?? null;
      pages += 1;
    }
    notes.push(`ll2_pages=${pages} launches=${launches.length}`);
    return { source: 'launch_library_2', ok: true, launches, notes };
  } catch (err) {
    return {
      source: 'launch_library_2',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      launches,
      notes,
    };
  }
}

export async function fetchMcdowell(): Promise<AdapterFetchResult> {
  try {
    const html = await satStatsFetchText(MCDOWELL_STARLINK_STATS_URL);
    const landingPath = saveLandingArtifact('mcdowell', 'stats', html, 'html');
    const snapshot = parseMcdowellSnapshotHtml(html);
    return {
      source: 'mcdowell',
      ok: true,
      landingPath,
      fleetSnapshots: [snapshot],
      notes: [`snapshot_date=${snapshot.snapshot_date}`],
    };
  } catch (err) {
    return {
      source: 'mcdowell',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchCelestrakCatalogMeta(): Promise<AdapterFetchResult> {
  const urls = [
    'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
    'http://www.celestrak.com/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
  ];
  for (const url of urls) {
    try {
      const text = await satStatsFetchText(url);
      const landingPath = saveLandingArtifact('celestrak', 'starlink_tle', text, 'tle');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const objectCount = Math.floor(lines.length / 3);
      return {
        source: 'celestrak',
        ok: true,
        landingPath,
        notes: [`tle_objects=${objectCount}`, `url=${url}`],
      };
    } catch {
      continue;
    }
  }
  return { source: 'celestrak', ok: false, error: 'All CelesTrak mirrors failed' };
}

export async function fetchSpaceTrack(): Promise<AdapterFetchResult> {
  const { SPACETRACK_USER, SPACETRACK_PASSWORD } = await import('../config.js');
  if (!SPACETRACK_USER || !SPACETRACK_PASSWORD) {
    return {
      source: 'spacetrack',
      ok: false,
      error: 'SPACETRACK_USER/PASSWORD not configured',
      notes: ['skipped'],
    };
  }
  try {
    const loginUrl = 'https://www.space-track.org/ajaxauth/login';
    const loginBody = new URLSearchParams({
      identity: SPACETRACK_USER,
      password: SPACETRACK_PASSWORD,
    });
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody,
      redirect: 'manual',
    });
    const cookie = loginRes.headers.get('set-cookie');
    if (!cookie) throw new Error('Space-Track login failed');
    const query =
      '/basicspacedata/query/class/gp/NORAD_CAT_ID/>40000/ORDINAL/1/format/json/DECAY_DATE/null-val/epoch/>now-30';
    const dataRes = await fetch(`https://www.space-track.org${query}`, {
      headers: { Cookie: cookie.split(';')[0]! },
      signal: AbortSignal.timeout(45_000),
    });
    const json = await dataRes.text();
    const landingPath = saveLandingArtifact('spacetrack', 'gp_recent', json);
    const parsed = JSON.parse(json) as unknown[];
    return {
      source: 'spacetrack',
      ok: true,
      landingPath,
      notes: [`gp_rows=${Array.isArray(parsed) ? parsed.length : 0}`],
    };
  } catch (err) {
    return {
      source: 'spacetrack',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchFccFilings(): Promise<AdapterFetchResult> {
  const { FCC_ECFS_API, FCC_SEARCH_TERMS } = await import('../config.js');
  const notes: string[] = [];
  try {
    for (const term of FCC_SEARCH_TERMS.slice(0, 2)) {
      const url = `${FCC_ECFS_API}?searchText=${encodeURIComponent(term)}&limit=5`;
      const body = await satStatsFetchJson<unknown>(url);
      saveLandingArtifact('fcc', `search_${term.replace(/\W+/g, '_')}`, JSON.stringify(body, null, 2));
      notes.push(`term=${term}`);
    }
    return { source: 'fcc', ok: true, notes };
  } catch (err) {
    return {
      source: 'fcc',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      notes,
    };
  }
}

export async function fetchSpaceXPressKits(): Promise<AdapterFetchResult> {
  try {
    const html = await satStatsFetchText('https://www.spacex.com/launches');
    const landingPath = saveLandingArtifact('spacex_press', 'launches', html, 'html');
    const missionCount = (html.match(/mission/gi) ?? []).length;
    return {
      source: 'spacex_press',
      ok: true,
      landingPath,
      notes: [`mission_mentions=${missionCount}`],
    };
  } catch (err) {
    return {
      source: 'spacex_press',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchWikipediaBootstrap(): Promise<AdapterFetchResult> {
  try {
    const launches = await scrapeWikipediaLaunches();
    return { source: 'wikipedia_bootstrap', ok: true, launches, notes: [`launches=${launches.length}`] };
  } catch (err) {
    return {
      source: 'wikipedia_bootstrap',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchHistoricalWikipediaBootstrap(): Promise<AdapterFetchResult> {
  try {
    const launches = await scrapeHistoricalWikipediaLaunches();
    return {
      source: 'wikipedia_bootstrap',
      ok: true,
      launches,
      notes: [`historical_launches=${launches.length}`],
    };
  } catch (err) {
    return {
      source: 'wikipedia_bootstrap',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const SOURCE_FETCHERS = [
  fetchSpaceTrack,
  fetchCelestrakCatalogMeta,
  fetchLaunchLibrary2,
  fetchFccFilings,
  fetchSpaceXPressKits,
  fetchMcdowell,
  fetchWikipediaBootstrap,
] as const;
