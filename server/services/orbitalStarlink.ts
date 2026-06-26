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

// NAME=STARLINK avoids CelesTrak's one-download-per-update 403 on GROUP=starlink.
const STARLINK_URL = 'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=JSON';
const CELESTRAK_HEADERS = { 'User-Agent': 'SPCX-Terminal/1.0' };
const TLE_CACHE_TTL = 8 * 60 * 60 * 1000;
/** Re-propagate positions from cached TLE without re-fetching CelesTrak. */
const POSITION_CACHE_TTL = 20_000;

import {
  STARLINK_SHELL_BANDS,
} from '../../src/data/starlinkShells.ts';

/** Inclination bands for live TLE shell assignment — align with src/data/starlinkShells.ts */
export const SHELL_BANDS = STARLINK_SHELL_BANDS;

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

export interface TrackedStarlinkSat {
  omm: StarlinkOmmRecord;
  satrec: SatRec;
  shell: number;
}

type OmmRecord = StarlinkOmmRecord;

interface TrackedSat extends TrackedStarlinkSat {}

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
  r: number;
  g: number;
  b: number;
  epoch: string;
}

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
  fetchedAt: string;
}

let trackedCatalog: { sats: TrackedSat[]; fetchedAt: number } | null = null;

export function shellIndexForInclination(inc: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < SHELL_BANDS.length; i++) {
    const diff = Math.abs(SHELL_BANDS[i]!.inc - inc);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
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

async function fetchStarlinkOmm(): Promise<OmmRecord[]> {
  const res = await fetch(STARLINK_URL, {
    headers: CELESTRAK_HEADERS,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`CelesTrak Starlink fetch failed: ${res.status}`);
  const data = (await res.json()) as OmmRecord[];
  return Array.isArray(data) ? data : [];
}

export function perigeeKmFromOmm(omm: StarlinkOmmRecord): number {
  const nRadPerSec = (omm.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.pow(398600.4418 / (nRadPerSec * nRadPerSec), 1 / 3);
  return a * (1 - (omm.ECCENTRICITY ?? 0)) - 6378.137;
}

export function apogeeKmFromOmm(omm: StarlinkOmmRecord): number {
  const nRadPerSec = (omm.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.pow(398600.4418 / (nRadPerSec * nRadPerSec), 1 / 3);
  return a * (1 + (omm.ECCENTRICITY ?? 0)) - 6378.137;
}

export function meanAltitudeKmFromOmm(omm: StarlinkOmmRecord): number {
  return (perigeeKmFromOmm(omm) + apogeeKmFromOmm(omm)) / 2;
}

export type StarlinkLifecycle = 'operational' | 'raising' | 'deorbiting' | 'other';

export function classifyStarlinkLifecycle(omm: StarlinkOmmRecord): StarlinkLifecycle {
  const perigee = perigeeKmFromOmm(omm);
  const apogee = apogeeKmFromOmm(omm);
  const ecc = omm.ECCENTRICITY ?? 0;

  if (perigee < 220) return 'deorbiting';
  if (perigee < 350 || (ecc > 0.0015 && perigee < 450)) return 'raising';
  if (perigee >= 350 && perigee <= 600 && apogee <= 650) return 'operational';
  return 'other';
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

export async function getTrackedStarlinkCatalog(): Promise<{
  sats: TrackedStarlinkSat[];
  fetchedAt: number;
}> {
  if (trackedCatalog && Date.now() - trackedCatalog.fetchedAt < TLE_CACHE_TTL) {
    return trackedCatalog;
  }

  const cached = getCached<{ sats: TrackedSat[]; fetchedAt: number }>('starlink:tle:v1');
  if (cached && Date.now() - cached.fetchedAt < TLE_CACHE_TTL) {
    trackedCatalog = cached;
    return cached;
  }

  return coalesceAsync('starlink:tle:fetch', async () => {
    try {
      const raw = await fetchStarlinkOmm();
      const sats: TrackedSat[] = [];

      for (const omm of raw) {
        if (!omm.NORAD_CAT_ID || !omm.EPOCH) continue;
        try {
          const satrec = json2satrec(omm);
          const shell = shellIndexForInclination(omm.INCLINATION);
          sats.push({ omm, satrec, shell });
        } catch {
          // skip malformed records
        }
      }

      const entry = { sats, fetchedAt: Date.now() };
      trackedCatalog = entry;
      setCache('starlink:tle:v1', entry, TLE_CACHE_TTL);
      return entry;
    } catch (err) {
      // CelesTrak may return 403 when data has not updated; reuse last good catalog.
      if (trackedCatalog?.sats.length) return trackedCatalog;
      const stale = getCached<{ sats: TrackedSat[]; fetchedAt: number }>('starlink:tle:v1');
      if (stale?.sats.length) {
        trackedCatalog = stale;
        return stale;
      }
      throw err;
    }
  });
}

function minuteBucket(d = new Date()): number {
  return Math.floor(d.getTime() / POSITION_CACHE_TTL);
}

function buildPositions(
  tracked: TrackedSat[],
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

    const band = SHELL_BANDS[sat.shell]!;
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
      lifecycle: classifyStarlinkLifecycle(sat.omm),
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
    const { sats, fetchedAt } = await getTrackedStarlinkCatalog();
    const when = new Date(bucket * POSITION_CACHE_TTL);
    const { meta, lat, lon, altKm, velLat, velLon, velAlt, ommMeanMotion, ommRaan, ommArgPerigee, ommMeanAnomaly, ommBstar, ommMeanMotionDot, ommMeanMotionDdot, ommElementSetNo } = buildPositions(sats, when);

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
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, payload, POSITION_CACHE_TTL);
    return payload;
  });
}
