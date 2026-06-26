import { getCached, setCache } from '../cache.js';
import {
  SHELL_BANDS,
  apogeeKmFromOmm,
  classifyStarlinkLifecycle,
  getTrackedStarlinkCatalog,
  meanAltitudeKmFromOmm,
  perigeeKmFromOmm,
  type StarlinkLifecycle,
  type StarlinkOmmRecord,
  type TrackedStarlinkSat,
} from './orbitalStarlink.js';

const STARLINK_MANIFEST_URL = 'https://api.starlink.com/public-files/ephemerides/MANIFEST.txt';
const INTEL_CACHE_TTL = 5 * 60_000;

export type { StarlinkLifecycle } from './orbitalStarlink.js';

export interface StarlinkShellStats {
  name: string;
  inclination: number;
  count: number;
  operational: number;
  raising: number;
  deorbiting: number;
  meanAltitudeKm: number;
}

export interface StarlinkRecentLaunch {
  intlDesignator: string;
  satelliteCount: number;
  dominantShell: string;
}

export interface StarlinkIntelPayload {
  totalTracked: number;
  ephemerisPublished: number;
  lifecycle: Record<StarlinkLifecycle, number>;
  shells: StarlinkShellStats[];
  medianEpochAgeHours: number;
  staleTleCount: number;
  launchedYtd: number;
  recentLaunches: StarlinkRecentLaunch[];
  tleFetchedAt: string;
  fetchedAt: string;
}

function classifyLifecycle(omm: StarlinkOmmRecord): StarlinkLifecycle {
  return classifyStarlinkLifecycle(omm);
}

function launchKey(objectId: string | undefined): string | null {
  if (!objectId) return null;
  const match = objectId.match(/^(\d{4}-\d+)/);
  return match?.[1] ?? null;
}

function epochAgeHours(epoch: string, now = Date.now()): number {
  const t = new Date(epoch).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 3_600_000);
}

async function fetchEphemerisCount(): Promise<number> {
  try {
    const res = await fetch(STARLINK_MANIFEST_URL, {
      headers: { 'User-Agent': 'SPCX-Terminal/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return 0;
    const text = await res.text();
    return text.split('\n').filter((line) => line.trim().endsWith('.txt')).length;
  } catch {
    return 0;
  }
}

function buildShellStats(sats: TrackedStarlinkSat[]): StarlinkShellStats[] {
  const buckets = SHELL_BANDS.map((band) => ({
    name: band.name,
    inclination: band.inc,
    count: 0,
    operational: 0,
    raising: 0,
    deorbiting: 0,
    altSum: 0,
  }));

  for (const sat of sats) {
    const bucket = buckets[sat.shell];
    if (!bucket) continue;

    const lifecycle = classifyLifecycle(sat.omm);
    bucket.count++;
    bucket.altSum += meanAltitudeKmFromOmm(sat.omm);
    if (lifecycle === 'operational') bucket.operational++;
    else if (lifecycle === 'raising') bucket.raising++;
    else if (lifecycle === 'deorbiting') bucket.deorbiting++;
  }

  return buckets.map((b) => ({
    name: b.name,
    inclination: b.inclination,
    count: b.count,
    operational: b.operational,
    raising: b.raising,
    deorbiting: b.deorbiting,
    meanAltitudeKm: b.count > 0 ? Math.round(b.altSum / b.count) : 0,
  }));
}

function buildRecentLaunches(sats: TrackedStarlinkSat[]): StarlinkRecentLaunch[] {
  const groups = new Map<string, { count: number; shells: Map<string, number> }>();

  for (const sat of sats) {
    const key = launchKey(sat.omm.OBJECT_ID);
    if (!key) continue;

    const entry = groups.get(key) ?? { count: 0, shells: new Map() };
    entry.count++;
    const shellName = SHELL_BANDS[sat.shell]?.name ?? '—';
    entry.shells.set(shellName, (entry.shells.get(shellName) ?? 0) + 1);
    groups.set(key, entry);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([intlDesignator, data]) => {
      let dominantShell = '—';
      let max = 0;
      for (const [shell, count] of data.shells) {
        if (count > max) {
          max = count;
          dominantShell = shell;
        }
      }
      return {
        intlDesignator,
        satelliteCount: data.count,
        dominantShell,
      };
    });
}

function countLaunchedYtd(sats: TrackedStarlinkSat[], year: number): number {
  const prefix = `${year}-`;
  return sats.filter((s) => s.omm.OBJECT_ID?.startsWith(prefix)).length;
}

export async function buildStarlinkIntelPayload(): Promise<StarlinkIntelPayload> {
  const cached = getCached<StarlinkIntelPayload>('starlink:intel:v1');
  if (cached) return cached;

  const [{ sats, fetchedAt }, ephemerisPublished] = await Promise.all([
    getTrackedStarlinkCatalog(),
    fetchEphemerisCount(),
  ]);

  const now = Date.now();
  const lifecycle: Record<StarlinkLifecycle, number> = {
    operational: 0,
    raising: 0,
    deorbiting: 0,
    other: 0,
  };

  const epochAges: number[] = [];
  let staleTleCount = 0;

  for (const sat of sats) {
    const state = classifyLifecycle(sat.omm);
    lifecycle[state]++;

    const ageH = epochAgeHours(sat.omm.EPOCH, now);
    epochAges.push(ageH);
    if (ageH > 168) staleTleCount++;
  }

  epochAges.sort((a, b) => a - b);
  const medianEpochAgeHours =
    epochAges.length > 0
      ? Math.round(epochAges[Math.floor(epochAges.length / 2)]! * 10) / 10
      : 0;

  const payload: StarlinkIntelPayload = {
    totalTracked: sats.length,
    ephemerisPublished,
    lifecycle,
    shells: buildShellStats(sats),
    medianEpochAgeHours,
    staleTleCount,
    launchedYtd: countLaunchedYtd(sats, new Date().getUTCFullYear()),
    recentLaunches: buildRecentLaunches(sats),
    tleFetchedAt: new Date(fetchedAt).toISOString(),
    fetchedAt: new Date().toISOString(),
  };

  setCache('starlink:intel:v1', payload, INTEL_CACHE_TTL);
  return payload;
}
