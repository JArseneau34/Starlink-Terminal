import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  type SatRec,
} from 'satellite.js';
import { coalesceAsync, getCached, setCache } from '../cache.js';
import type { StarlinkModelHint } from '../../src/data/starlinkVisualShells.ts';
import {
  CANONICAL_SHELL_BANDS,
  type StarlinkCatalogShell,
} from '../../src/data/starlinkShellBands.ts';
import {
  meanAltitudeKmFromOmm,
  perigeeKmFromOmm,
  apogeeKmFromOmm,
  type StarlinkLifecycle,
} from '../../src/data/starlinkOrbitOmm.ts';
import {
  getStarlinkCatalogBucketStatus,
  refreshStarlinkCatalog,
  resolveStarlinkCatalog,
  type BucketedStarlinkSat,
  type StarlinkOmmRecord,
  type StarlinkTleSource,
} from './starlinkCatalogFetch.js';

export type { StarlinkOmmRecord, StarlinkTleSource } from './starlinkCatalogFetch.js';
export {
  apogeeKmFromOmm,
  classifyStarlinkLifecycle,
  classifyStarlinkLifecycleFromOmm,
  meanAltitudeKmFromOmm,
  perigeeKmFromOmm,
  type StarlinkLifecycle,
} from '../../src/data/starlinkOrbitOmm.ts';
export { shellIndexForInclination } from '../../src/data/starlinkShellBands.ts';

const POSITION_CACHE_TTL = 20_000;

export const SHELL_BANDS = CANONICAL_SHELL_BANDS;

export interface TrackedStarlinkSat {
  omm: StarlinkOmmRecord;
  satrec: SatRec;
  shell: number;
  lifecycle: StarlinkLifecycle;
  modelHint: StarlinkModelHint;
}

export interface StarlinkSatMeta {
  noradId: number;
  name: string;
  objectId: string | null;
  launchBatch: string | null;
  inclination: number;
  shell: number;
  shellName: string;
  perigeeKm: number;
  apogeeKm: number;
  eccentricity: number;
  lifecycle: StarlinkLifecycle;
  modelHint: StarlinkModelHint;
  r: number;
  g: number;
  b: number;
  epoch: string;
}

export type { StarlinkCatalogShell };

export interface StarlinkCatalogPayload {
  count: number;
  referenceTime: string;
  tleFetchedAt: string;
  satellites: StarlinkSatMeta[];
  lat: number[];
  lon: number[];
  altKm: number[];
  velLat: number[];
  velLon: number[];
  velAlt: number[];
  ommMeanMotion: number[];
  ommRaan: number[];
  ommArgPerigee: number[];
  ommMeanAnomaly: number[];
  ommBstar: number[];
  ommMeanMotionDot: number[];
  ommMeanMotionDdot: number[];
  ommElementSetNo: number[];
  shells: StarlinkCatalogShell[];
  tleSource: StarlinkTleSource;
  fetchedAt: string;
}

export interface StarlinkCatalogStatus {
  count: number;
  tleFetchedAt: string;
  tleExpiresAt: string;
  source: StarlinkTleSource;
  shells: StarlinkCatalogShell[];
}

function satrecFromOmm(omm: StarlinkOmmRecord): SatRec | null {
  try {
    return json2satrec(omm);
  } catch {
    return null;
  }
}

function hydrateTrackedSats(bucketed: BucketedStarlinkSat[]): TrackedStarlinkSat[] {
  const sats: TrackedStarlinkSat[] = [];
  for (const row of bucketed) {
    const satrec = satrecFromOmm(row.omm);
    if (!satrec) continue;
    sats.push({
      omm: row.omm,
      satrec,
      shell: row.shell,
      lifecycle: row.lifecycle,
      modelHint: row.modelHint,
    });
  }
  return sats;
}

export async function getTrackedStarlinkCatalog(): Promise<{
  sats: TrackedStarlinkSat[];
  fetchedAt: number;
  source: StarlinkTleSource;
  shells: StarlinkCatalogShell[];
  offline: boolean;
}> {
  const catalog = await resolveStarlinkCatalog();
  return {
    sats: hydrateTrackedSats(catalog.sats),
    fetchedAt: catalog.fetchedAt,
    source: catalog.source,
    shells: catalog.shells,
    offline: catalog.offline,
  };
}

export async function refreshStarlinkTle(): Promise<void> {
  await refreshStarlinkCatalog();
}

export function getStarlinkCatalogStatus(catalog: {
  sats: TrackedStarlinkSat[];
  fetchedAt: number;
  source: StarlinkTleSource;
  shells: StarlinkCatalogShell[];
}): StarlinkCatalogStatus {
  return getStarlinkCatalogBucketStatus({
    sats: catalog.sats.map((s) => ({
      omm: s.omm,
      shell: s.shell,
      lifecycle: s.lifecycle,
      modelHint: s.modelHint,
    })),
    shells: catalog.shells,
    count: catalog.sats.length,
    fetchedAt: catalog.fetchedAt,
    source: catalog.source,
    offline: false,
  });
}

function colorComponents(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function positionAt(satrec: SatRec, date: Date): { lat: number; lon: number; altKm: number } | null {
  try {
    const pv = propagate(satrec, date);
    if (!pv?.position) return null;
    const gmst = gstime(date);
    const gd = eciToGeodetic(pv.position, gmst);
    return {
      lat: degreesLat(gd.latitude),
      lon: degreesLong(gd.longitude),
      altKm: gd.height,
    };
  } catch {
    return null;
  }
}

export function launchBatchFromObjectId(objectId: string | undefined): string | null {
  if (!objectId) return null;
  const match = objectId.match(/^(\d{4}-\d+)/);
  return match?.[1] ?? null;
}

export function groundSpeedKms(
  lat: number,
  velLat: number,
  velLon: number,
  velAlt: number
): number {
  const latRad = (lat * Math.PI) / 180;
  const vx = velLon * 111.32 * Math.cos(latRad);
  const vy = velLat * 110.574;
  return Math.sqrt(vx * vx + vy * vy + velAlt * velAlt);
}

function minuteBucket(d = new Date()): number {
  return Math.floor(d.getTime() / POSITION_CACHE_TTL);
}

function buildPositions(
  tracked: TrackedStarlinkSat[],
  when: Date
): {
  meta: StarlinkSatMeta[];
  lat: number[];
  lon: number[];
  altKm: number[];
  velLat: number[];
  velLon: number[];
  velAlt: number[];
  ommMeanMotion: number[];
  ommRaan: number[];
  ommArgPerigee: number[];
  ommMeanAnomaly: number[];
  ommBstar: number[];
  ommMeanMotionDot: number[];
  ommMeanMotionDdot: number[];
  ommElementSetNo: number[];
} {
  const later = new Date(when.getTime() + POSITION_CACHE_TTL);
  const meta: StarlinkSatMeta[] = [];
  const lat: number[] = [];
  const lon: number[] = [];
  const altKm: number[] = [];
  const velLat: number[] = [];
  const velLon: number[] = [];
  const velAlt: number[] = [];
  const ommMeanMotion: number[] = [];
  const ommRaan: number[] = [];
  const ommArgPerigee: number[] = [];
  const ommMeanAnomaly: number[] = [];
  const ommBstar: number[] = [];
  const ommMeanMotionDot: number[] = [];
  const ommMeanMotionDdot: number[] = [];
  const ommElementSetNo: number[] = [];

  for (const sat of tracked) {
    const pos = positionAt(sat.satrec, when);
    const posLater = positionAt(sat.satrec, later);
    if (!pos || !posLater) continue;

    const band = CANONICAL_SHELL_BANDS[sat.shell]!;
    const [r, g, b] = colorComponents(band.color);

    const perigeeKm = Math.round(perigeeKmFromOmm(sat.omm) * 10) / 10;
    const apogeeKm = Math.round(apogeeKmFromOmm(sat.omm) * 10) / 10;

    meta.push({
      noradId: sat.omm.NORAD_CAT_ID,
      name: sat.omm.OBJECT_NAME,
      objectId: sat.omm.OBJECT_ID ?? null,
      launchBatch: launchBatchFromObjectId(sat.omm.OBJECT_ID),
      inclination: Math.round(sat.omm.INCLINATION * 100) / 100,
      shell: sat.shell,
      shellName: band.name,
      perigeeKm,
      apogeeKm,
      eccentricity: Math.round((sat.omm.ECCENTRICITY ?? 0) * 1_000_000) / 1_000_000,
      lifecycle: sat.lifecycle,
      modelHint: sat.modelHint,
      r,
      g,
      b,
      epoch: sat.omm.EPOCH,
    });

    lat.push(Math.round(pos.lat * 1000) / 1000);
    lon.push(Math.round(pos.lon * 1000) / 1000);
    altKm.push(Math.round(pos.altKm * 10) / 10);

    const dtSec = POSITION_CACHE_TTL / 1000;
    let dLon = posLater.lon - pos.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    velLat.push((posLater.lat - pos.lat) / dtSec);
    velLon.push(dLon / dtSec);
    velAlt.push((posLater.altKm - pos.altKm) / dtSec);

    ommMeanMotion.push(sat.omm.MEAN_MOTION);
    ommRaan.push(Number(sat.omm.RA_OF_ASC_NODE ?? 0));
    ommArgPerigee.push(Number(sat.omm.ARG_OF_PERICENTER ?? 0));
    ommMeanAnomaly.push(Number(sat.omm.MEAN_ANOMALY ?? 0));
    ommBstar.push(Number(sat.omm.BSTAR ?? 0));
    ommMeanMotionDot.push(Number(sat.omm.MEAN_MOTION_DOT ?? 0));
    ommMeanMotionDdot.push(Number(sat.omm.MEAN_MOTION_DDOT ?? 0));
    ommElementSetNo.push(Number(sat.omm.ELEMENT_SET_NO ?? 999));
  }

  return {
    meta,
    lat,
    lon,
    altKm,
    velLat,
    velLon,
    velAlt,
    ommMeanMotion,
    ommRaan,
    ommArgPerigee,
    ommMeanAnomaly,
    ommBstar,
    ommMeanMotionDot,
    ommMeanMotionDdot,
    ommElementSetNo,
  };
}

export async function buildStarlinkPayload(): Promise<StarlinkCatalogPayload> {
  const bucket = minuteBucket();
  const cacheKey = `starlink:pos:v1:${bucket}`;
  const cached = getCached<StarlinkCatalogPayload>(cacheKey);
  if (cached) return cached;

  return coalesceAsync(cacheKey, async () => {
    const { sats, fetchedAt, source, shells } = await getTrackedStarlinkCatalog();
    const when = new Date(bucket * POSITION_CACHE_TTL);
    const {
      meta,
      lat,
      lon,
      altKm,
      velLat,
      velLon,
      velAlt,
      ommMeanMotion,
      ommRaan,
      ommArgPerigee,
      ommMeanAnomaly,
      ommBstar,
      ommMeanMotionDot,
      ommMeanMotionDdot,
      ommElementSetNo,
    } = buildPositions(sats, when);

    const payload: StarlinkCatalogPayload = {
      count: meta.length,
      referenceTime: when.toISOString(),
      tleFetchedAt: new Date(fetchedAt).toISOString(),
      satellites: meta,
      lat,
      lon,
      altKm,
      velLat,
      velLon,
      velAlt,
      ommMeanMotion,
      ommRaan,
      ommArgPerigee,
      ommMeanAnomaly,
      ommBstar,
      ommMeanMotionDot,
      ommMeanMotionDdot,
      ommElementSetNo,
      shells,
      tleSource: source,
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, payload, POSITION_CACHE_TTL);
    return payload;
  });
}
