import { getCached, setCache } from '../cache.js';
import type {
  LaunchPadMarker,
  LaunchSite,
  LaunchSiteActivity,
  ManifestDeparture,
  VehicleSpec,
} from '../../src/types/launchManifest.js';
import { cloneSeedSites } from '../../src/data/launchSitesSeed.js';
import { VEHICLE_SPECS } from '../../src/data/launchManifest.js';
import { fetchLL2 } from './launches.js';

const SITES_CACHE_KEY = 'launch-sites:v2';
const VEHICLES_CACHE_KEY = 'launch-vehicles:v2';
const SITES_CACHE_TTL = 15 * 60_000;
const VEHICLES_CACHE_TTL = 30 * 60_000;

async function fetchEnrichment<T>(path: string): Promise<T | null> {
  const { data } = await fetchLL2<T>(path);
  return data;
}

interface LL2Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  active: boolean;
  total_launch_count?: number;
  country?: { alpha_2_code?: string; name?: string };
}

interface LL2Paginated<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface LL2Pad {
  id: number;
  name: string;
  active: boolean;
  latitude: string | number;
  longitude: string | number;
  total_launch_count?: number;
  country?: { alpha_2_code?: string; name?: string };
  location?: {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
    total_launch_count?: number;
  };
}

interface LL2Launch {
  id: string;
  name: string;
  net: string;
  status?: { name: string };
  launch_service_provider?: { name: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: { id: number; name: string; location?: { id: number; name: string } };
}

interface LL2LauncherDetail {
  id: number;
  name: string;
  full_name: string;
  active: boolean;
  leo_capacity?: number | null;
  gto_capacity?: number | null;
  to_thrust?: number | null;
  length?: number | null;
  diameter?: number | null;
  reusable?: boolean;
  families?: { name: string }[];
  manufacturer?: { name: string };
  total_launch_count?: number | null;
}

const VEHICLE_LL2_IDS: Record<string, number> = {
  'falcon9': 164,
  'falcon-heavy': 27,
  'starship': 476,
  'electron': 26,
  'neutron': 474,
  'new-glenn': 469,
  'vulcan': 342,
  'atlas-v': 3,
  'ariane6': 389,
  'lvm3': 143,
};

const RANGE_ALIASES: Record<string, string[]> = {
  'cape canaveral': ['cape canaveral', 'kennedy space center', 'patrick space force'],
  'kennedy space center': ['kennedy space center', 'cape canaveral'],
  'vandenberg': ['vandenberg'],
  'mahia': ['mahia', 'rocket lab launch complex'],
  'kourou': ['kourou', 'guiana space centre', 'guiana space center', 'centre spatial guyanais'],
  'satish dhawan': ['satish dhawan', 'sriharikota'],
  'wenchang': ['wenchang'],
  'baikonur': ['baikonur'],
  'wallops': ['wallops', 'mid-atlantic'],
  'tanegashima': ['tanegashima'],
};

function toActivity(launch: LL2Launch): LaunchSiteActivity {
  return {
    id: launch.id,
    name: launch.name,
    vehicle:
      launch.rocket?.configuration?.full_name ??
      launch.rocket?.configuration?.name ??
      'Unknown',
    provider: launch.launch_service_provider?.name ?? 'Unknown',
    net: launch.net,
    status: launch.status?.name ?? 'TBD',
    padName: launch.pad?.name ?? 'TBD',
  };
}

async function fetchAllActivePads(): Promise<LL2Pad[]> {
  const data = await fetchEnrichment<LL2Paginated<LL2Pad>>(
    '/pads/?active=true&limit=100'
  );
  return data?.results ?? [];
}

async function fetchActiveLocations(): Promise<LL2Location[]> {
  const data = await fetchEnrichment<LL2Paginated<LL2Location>>(
    '/locations/?active=true&limit=100'
  );
  return data?.results ?? [];
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function siteMatchesDeparture(site: LaunchSite, dep: ManifestDeparture): boolean {
  const range = normalizeKey(dep.range);
  const siteName = normalizeKey(site.name);
  if (!range || range === 'tbd') return false;
  if (range === siteName) return true;

  const rangeHead = range.split(' ').slice(0, 4).join(' ');
  const siteHead = siteName.split(' ').slice(0, 4).join(' ');
  if (rangeHead === siteHead || siteName.includes(rangeHead) || range.includes(siteHead)) {
    return true;
  }

  for (const [key, aliases] of Object.entries(RANGE_ALIASES)) {
    const rangeHit = aliases.some((a) => range.includes(a));
    const siteHit = aliases.some((a) => siteName.includes(a)) || siteName.includes(key);
    if (rangeHit && siteHit) return true;
  }

  return false;
}

function departureToActivity(dep: ManifestDeparture): LaunchSiteActivity {
  return {
    id: dep.id,
    name: dep.flight,
    vehicle: dep.vehicle,
    provider: dep.provider,
    net: dep.net,
    status: dep.status,
    padName: dep.pad,
  };
}

function attachActivities(
  sites: LaunchSite[],
  departures: ManifestDeparture[],
  upcomingLaunches: LL2Launch[],
  recentLaunches: LL2Launch[]
): void {
  const upcomingByLocation = new Map<number, LaunchSiteActivity[]>();
  const recentByLocation = new Map<number, LaunchSiteActivity[]>();

  for (const launch of upcomingLaunches) {
    const locId = launch.pad?.location?.id;
    if (!locId) continue;
    const list = upcomingByLocation.get(locId) ?? [];
    list.push(toActivity(launch));
    upcomingByLocation.set(locId, list);
  }

  for (const launch of recentLaunches) {
    const locId = launch.pad?.location?.id;
    if (!locId) continue;
    const list = recentByLocation.get(locId) ?? [];
    list.push(toActivity(launch));
    recentByLocation.set(locId, list);
  }

  for (const site of sites) {
    const locId = Number(site.id);
    if (Number.isFinite(locId)) {
      const fromLl2Up = upcomingByLocation.get(locId) ?? [];
      const fromLl2Recent = recentByLocation.get(locId) ?? [];
      site.upcoming.push(...fromLl2Up);
      site.recent.push(...fromLl2Recent);
    }

    for (const dep of departures) {
      if (!siteMatchesDeparture(site, dep)) continue;
      if (!site.upcoming.some((a) => a.id === dep.id)) {
        site.upcoming.push(departureToActivity(dep));
      }
    }

    site.upcoming.sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime());
    site.recent.sort((a, b) => new Date(b.net).getTime() - new Date(a.net).getTime());
  }
}

function buildSitesFromPads(
  pads: LL2Pad[],
  locations: LL2Location[]
): LaunchSite[] {
  const siteMap = new Map<string, LaunchSite>();

  for (const pad of pads) {
    const loc = pad.location;
    if (!loc?.id) continue;

    const lat = Number(pad.latitude);
    const lon = Number(pad.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const siteId = String(loc.id);
    const marker: LaunchPadMarker = {
      id: String(pad.id),
      name: pad.name,
      latitude: lat,
      longitude: lon,
      totalLaunchCount: pad.total_launch_count ?? 0,
    };

    const existing = siteMap.get(siteId);
    if (existing) {
      existing.pads.push(marker);
      existing.activePadCount += 1;
      existing.totalLaunchCount += marker.totalLaunchCount;
      continue;
    }

    siteMap.set(siteId, {
      id: siteId,
      name: loc.name,
      latitude: loc.latitude ?? lat,
      longitude: loc.longitude ?? lon,
      countryCode: pad.country?.alpha_2_code ?? '—',
      countryName: pad.country?.name ?? 'Unknown',
      activePadCount: 1,
      totalLaunchCount: marker.totalLaunchCount,
      pads: [marker],
      upcoming: [],
      recent: [],
    });
  }

  if (siteMap.size === 0 && locations.length > 0) {
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      siteMap.set(String(loc.id), {
        id: String(loc.id),
        name: loc.name,
        latitude: lat,
        longitude: lon,
        countryCode: loc.country?.alpha_2_code ?? '—',
        countryName: loc.country?.name ?? 'Unknown',
        activePadCount: 0,
        totalLaunchCount: loc.total_launch_count ?? 0,
        pads: [],
        upcoming: [],
        recent: [],
      });
    }
  }

  return [...siteMap.values()];
}

export function buildSeedLaunchSites(departures: ManifestDeparture[]): LaunchSite[] {
  const sites = cloneSeedSites();
  attachActivities(sites, departures, [], []);
  return sites.sort((a, b) => {
    const aScore = a.upcoming.length * 10 + a.recent.length;
    const bScore = b.upcoming.length * 10 + b.recent.length;
    return bScore - aScore;
  });
}

async function fetchLaunchSitesLive(departures: ManifestDeparture[]): Promise<LaunchSite[]> {
  const [previousResult, upcomingResult, pads, locations] = await Promise.all([
    fetchEnrichment<LL2Paginated<LL2Launch>>('/launches/previous/?limit=50&ordering=-net'),
    fetchEnrichment<LL2Paginated<LL2Launch>>('/launches/upcoming/?limit=50&ordering=net'),
    fetchAllActivePads(),
    fetchActiveLocations(),
  ]);

  const sites = buildSitesFromPads(pads, locations);
  if (sites.length === 0) return [];

  attachActivities(
    sites,
    departures,
    upcomingResult?.results ?? [],
    previousResult?.results ?? []
  );

  return sites.sort((a, b) => {
    const aScore = a.upcoming.length * 10 + a.recent.length + a.activePadCount;
    const bScore = b.upcoming.length * 10 + b.recent.length + b.activePadCount;
    if (bScore !== aScore) return bScore - aScore;
    return b.totalLaunchCount - a.totalLaunchCount;
  });
}

export async function fetchLaunchSites(departures: ManifestDeparture[]): Promise<LaunchSite[]> {
  try {
    const live = await fetchLaunchSitesLive(departures);
    if (live.length > 0) {
      setCache(SITES_CACHE_KEY, live, SITES_CACHE_TTL);
      return live;
    }
  } catch {
    // fall through
  }

  const cached = getCached<LaunchSite[]>(SITES_CACHE_KEY);
  if (cached?.length) {
    const sites = cached.map((s) => ({
      ...s,
      pads: s.pads.map((p) => ({ ...p })),
      upcoming: [...s.upcoming],
      recent: [...s.recent],
    }));
    attachActivities(sites, departures, [], []);
    return sites;
  }

  return buildSeedLaunchSites(departures);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mapLauncherDetail(detail: LL2LauncherDetail, seed?: VehicleSpec): VehicleSpec {
  const provider = detail.manufacturer?.name ?? seed?.provider ?? 'Unknown';
  const reusableBool = detail.reusable ?? seed?.reusableBool ?? null;
  const reusableLabel = reusableBool === true
    ? 'Reusable'
    : reusableBool === false
      ? 'Expendable'
      : seed?.reusable ?? '—';

  return {
    id: seed?.id ?? slugify(detail.full_name || detail.name),
    vehicle: detail.full_name || detail.name,
    provider,
    payloadLeoKg: detail.leo_capacity ?? seed?.payloadLeoKg ?? 0,
    payloadGtoKg: detail.gto_capacity ?? seed?.payloadGtoKg ?? 0,
    payloadTliKg: seed?.payloadTliKg ?? 0,
    reusable: reusableLabel,
    fairingVolumeM3: seed?.fairingVolumeM3 ?? 0,
    costPerKgLeo: seed?.costPerKgLeo ?? 0,
    status: detail.active ? (seed?.status ?? 'ACTIVE') : 'RETIRING',
    thrustKn: detail.to_thrust ?? seed?.thrustKn ?? null,
    heightM: detail.length ?? seed?.heightM ?? null,
    diameterM: detail.diameter ?? seed?.diameterM ?? null,
    reusableBool,
    ll2Id: detail.id,
  };
}

async function fetchLauncherDetail(id: number): Promise<LL2LauncherDetail | null> {
  return fetchEnrichment<LL2LauncherDetail>(`/launcher_configurations/${id}/`);
}

async function fetchVehicleSpecsLive(): Promise<VehicleSpec[]> {
  const seeds = VEHICLE_SPECS as VehicleSpec[];
  const knownIds = Object.values(VEHICLE_LL2_IDS);

  const detailResults = await Promise.all(knownIds.map((id) => fetchLauncherDetail(id)));

  const byLl2Id = new Map<number, LL2LauncherDetail>();
  for (const detail of detailResults) {
    if (detail) byLl2Id.set(detail.id, detail);
  }

  return seeds.map((seed) => {
    const ll2Id = VEHICLE_LL2_IDS[seed.id];
    const detail = ll2Id ? byLl2Id.get(ll2Id) : undefined;
    return detail ? mapLauncherDetail(detail, seed) : seed;
  });
}

export async function fetchVehicleSpecs(): Promise<VehicleSpec[]> {
  try {
    const live = await fetchVehicleSpecsLive();
    if (live.length > 0) {
      setCache(VEHICLES_CACHE_KEY, live, VEHICLES_CACHE_TTL);
      return live;
    }
  } catch {
    // fall through
  }

  const cached = getCached<VehicleSpec[]>(VEHICLES_CACHE_KEY);
  if (cached?.length) return cached;

  return VEHICLE_SPECS as VehicleSpec[];
}
