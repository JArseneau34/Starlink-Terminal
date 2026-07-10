import { getCached, setCache } from '../cache.js';
import type { StarlinkFleetSnapshot } from '../../src/data/starlinkFleetSnapshot.ts';
import { buildShellSummary } from '../../src/data/starlinkShellBands.ts';
import { orbitalShellName } from '../../src/data/orbitalShellClassification.ts';
import {
  resolveFleetSnapshot,
  type PipelineFleetMeta,
} from './pipelineFleet.js';
import {
  apogeeKmFromOmm,
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

export interface StarlinkFleetModelCounts {
  v1: number;
  v15: number;
  v2Mini: number;
  v2MiniD2c: number;
  v2MiniOpt: number;
}

export interface StarlinkFleetReconciliation {
  tleTracked: number;
  delta: number;
  note: string;
}

export interface StarlinkFleetAuthoritative {
  totalWorking: number;
  totalDown: number;
  snapshotDate: string;
  models: StarlinkFleetModelCounts;
  bandwidthTbps: number;
  reconciliation: StarlinkFleetReconciliation;
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
  authoritative: StarlinkFleetAuthoritative;
  /** False when the live CelesTrak TLE feed was unreachable and the payload is snapshot-only. */
  liveTleAvailable: boolean;
  tleFetchedAt: string;
  fetchedAt: string;
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
  return buildShellSummary(
    sats.map((sat) => ({
      shell: sat.shell,
      meanAltitudeKm: meanAltitudeKmFromOmm(sat.omm),
      lifecycle: sat.lifecycle,
    }))
  );
}

function buildRecentLaunches(sats: TrackedStarlinkSat[]): StarlinkRecentLaunch[] {
  const groups = new Map<string, { count: number; shells: Map<string, number> }>();

  for (const sat of sats) {
    const key = launchKey(sat.omm.OBJECT_ID);
    if (!key) continue;

    const entry = groups.get(key) ?? { count: 0, shells: new Map() };
    entry.count++;
    const shellName = orbitalShellName(sat.shell);
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

function buildAuthoritativeBlock(
  tleTracked: number,
  snap: StarlinkFleetSnapshot,
  meta: PipelineFleetMeta,
  liveTleAvailable: boolean
): StarlinkFleetAuthoritative {
  const delta = tleTracked - snap.totalWorking;
  let note = 'NORAD TLE count matches McDowell working fleet.';
  if (!liveTleAvailable) {
    note =
      'Live CelesTrak NORAD feed unavailable — figures shown are from the McDowell / pipeline snapshot.';
  } else if (delta > 0) {
    note = `CelesTrak tracks ${delta.toLocaleString()} more than McDowell working total (raising/decay TLEs or catalog lag).`;
  } else if (delta < 0) {
    note = `McDowell reports ${Math.abs(delta).toLocaleString()} more working sats than NORAD TLE set (snapshot ahead of TLE refresh).`;
  }
  if (meta.source === 'sat-stats') {
    const id = meta.snapshotId != null ? ` #${meta.snapshotId}` : '';
    note = `sat-stats snapshot${id}. ${note}`;
  } else if (meta.source === 'pipeline') {
    const id = meta.snapshotId != null ? ` #${meta.snapshotId}` : '';
    note = `Pipeline live snapshot${id}. ${note}`;
  }

  return {
    totalInOrbit: snap.totalInOrbit,
    totalWorking: snap.totalWorking,
    totalDown: snap.totalDown,
    snapshotDate: snap.snapshotDate,
    models: { ...snap.models },
    bandwidthTbps: snap.totalBandwidthInOrbitTbps,
    reconciliation: {
      // When the live feed is down we have no meaningful TLE count or delta.
      tleTracked: liveTleAvailable ? tleTracked : 0,
      delta: liveTleAvailable ? delta : 0,
      note,
    },
  };
}

export async function buildStarlinkIntelPayload(): Promise<StarlinkIntelPayload> {
  const cached = getCached<StarlinkIntelPayload>('starlink:intel:v2');
  if (cached) return cached;

  // The live CelesTrak TLE fetch can fail (upstream 403/timeout/network). Degrade gracefully
  // instead of throwing so the authoritative McDowell/pipeline fleet data still renders.
  const [catalog, ephemerisPublished, fleetResolved] = await Promise.all([
    getTrackedStarlinkCatalog().then(
      (result) => ({ ...result, liveTleAvailable: !result.offline }),
      () => ({ sats: [] as TrackedStarlinkSat[], fetchedAt: 0, liveTleAvailable: false })
    ),
    fetchEphemerisCount().catch(() => 0),
    resolveFleetSnapshot(),
  ]);

  const { sats, fetchedAt, liveTleAvailable } = catalog;
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
    const state = sat.lifecycle;
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
    authoritative: buildAuthoritativeBlock(
      sats.length,
      fleetResolved.fleet,
      fleetResolved.meta,
      liveTleAvailable
    ),
    liveTleAvailable,
    tleFetchedAt: new Date(liveTleAvailable && fetchedAt ? fetchedAt : now).toISOString(),
    fetchedAt: new Date().toISOString(),
  };

  // Only cache fully-live payloads; a snapshot-only result should retry the live feed soon.
  if (liveTleAvailable) {
    setCache('starlink:intel:v2', payload, INTEL_CACHE_TTL);
  } else {
    setCache('starlink:intel:v2', payload, 30_000);
  }
  return payload;
}
