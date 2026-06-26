import { json2satrec, propagate, gstime, degreesLat, degreesLong, eciToGeodetic } from '../lib/satelliteJsCore';
import type { OMMJsonObject, SatRec } from 'satellite.js';
import type { StarlinkCatalogPayload, StarlinkSatMeta } from '../types/orbital';
import {
  STARLINK_SHELLS,
  meanMotionRevPerDay,
  type StarlinkSatellite,
} from '../components/starlink/starlinkCatalog';

const TAU = Math.PI * 2;
const EARTH_RADIUS_KM = 6371;

export const TOPOLOGY_REFERENCE_EPOCH = '2024-01-01T00:00:00.000Z';

export interface GeodeticPosition {
  lat: number;
  lon: number;
  altKm: number;
}

/** Circular Walker ECI position — matches grid RAAN / mean anomaly exactly. */
export function propagateWalkerSatellite(
  sat: StarlinkSatellite,
  when: Date,
  epoch: Date
): GeodeticPosition {
  const sh = STARLINK_SHELLS[sat.shell]!;
  const inc = sh.inc * (Math.PI / 180);
  const raan = sat.raan;
  const dtSec = (when.getTime() - epoch.getTime()) / 1000;
  const n = meanMotionRevPerDay(sh.altKm) * (TAU / 86400);
  let M = sat.phase0 + n * dtSec;
  M = ((M % TAU) + TAU) % TAU;
  const rKm = EARTH_RADIUS_KM + sh.altKm;
  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const cosM = Math.cos(M);
  const sinM = Math.sin(M);
  const x = rKm * (cosO * cosM - sinO * sinM * cosI);
  const y = rKm * (sinO * cosM + cosO * sinM * cosI);
  const z = rKm * sinM * sinI;
  const gd = eciToGeodetic({ x, y, z }, gstime(when));
  return {
    lat: degreesLat(gd.latitude),
    lon: degreesLong(gd.longitude),
    altKm: gd.height,
  };
}

function radiansToOmmDegrees(rad: number): number {
  let deg = (rad * 180) / Math.PI;
  deg %= 360;
  if (deg < 0) deg += 360;
  return deg;
}

export interface GeodeticVelocity {
  velLat: number;
  velLon: number;
  velAlt: number;
}

export function hasClientPropagation(catalog: StarlinkCatalogPayload): boolean {
  return (
    Array.isArray(catalog.ommMeanMotion) &&
    catalog.ommMeanMotion.length === catalog.count &&
    Array.isArray(catalog.ommRaan) &&
    catalog.ommRaan.length === catalog.count
  );
}

export function ommJsonFromCatalog(
  catalog: StarlinkCatalogPayload,
  index: number
): OMMJsonObject | null {
  const meta = catalog.satellites[index];
  const meanMotion = catalog.ommMeanMotion?.[index];
  const raan = catalog.ommRaan?.[index];
  const argPerigee = catalog.ommArgPerigee?.[index];
  const meanAnomaly = catalog.ommMeanAnomaly?.[index];
  if (!meta || meanMotion == null || raan == null || argPerigee == null || meanAnomaly == null) {
    return null;
  }

  return {
    OBJECT_NAME: meta.name,
    OBJECT_ID: meta.objectId ?? '',
    NORAD_CAT_ID: meta.noradId,
    EPOCH: meta.epoch,
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: meta.eccentricity,
    INCLINATION: meta.inclination,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argPerigee,
    MEAN_ANOMALY: meanAnomaly,
    ELEMENT_SET_NO: catalog.ommElementSetNo?.[index] ?? 999,
    BSTAR: catalog.ommBstar?.[index] ?? 0,
    MEAN_MOTION_DOT: catalog.ommMeanMotionDot?.[index] ?? 0,
    MEAN_MOTION_DDOT: catalog.ommMeanMotionDdot?.[index] ?? 0,
    EPHEMERIS_TYPE: 0,
  };
}

export function satrecFromCatalogIndex(
  catalog: StarlinkCatalogPayload,
  index: number
): SatRec | null {
  const omm = ommJsonFromCatalog(catalog, index);
  if (!omm) return null;
  try {
    return json2satrec(omm);
  } catch {
    return null;
  }
}

export function buildSatrecCache(catalog: StarlinkCatalogPayload): (SatRec | null)[] {
  const cache: (SatRec | null)[] = new Array(catalog.count);
  for (let i = 0; i < catalog.count; i++) {
    cache[i] = satrecFromCatalogIndex(catalog, i);
  }
  return cache;
}

/**
 * Walker topology as compact OMM elements — same SGP4 path as live TLEs.
 * Orbital elements always follow the Walker grid (RAAN / mean anomaly match ISL edges).
 * When liveCatalog is provided, only referenceTime is synced so propagation tracks catalog refresh.
 */
export function buildTopologyCatalogPayload(
  satellites: StarlinkSatellite[],
  liveCatalog?: StarlinkCatalogPayload | null
): StarlinkCatalogPayload {
  const epoch = liveCatalog?.referenceTime ?? TOPOLOGY_REFERENCE_EPOCH;
  const epochDate = new Date(epoch);
  const count = satellites.length;

  const meta: StarlinkSatMeta[] = new Array(count);
  const ommMeanMotion = new Array<number>(count);
  const ommRaan = new Array<number>(count);
  const ommArgPerigee = new Array<number>(count);
  const ommMeanAnomaly = new Array<number>(count);
  const lat = new Array<number>(count);
  const lon = new Array<number>(count);
  const altKm = new Array<number>(count);

  for (let i = 0; i < count; i++) {
    const s = satellites[i]!;
    const sh = STARLINK_SHELLS[s.shell]!;

    ommMeanMotion[i] = meanMotionRevPerDay(sh.altKm);
    ommRaan[i] = radiansToOmmDegrees(s.raan);
    ommArgPerigee[i] = 0;
    ommMeanAnomaly[i] = radiansToOmmDegrees(s.phase0);

    meta[i] = {
      noradId: 90_000_000 + i,
      name: `SYN-${sh.name}-P${String(s.plane).padStart(2, '0')}-S${String(s.idx).padStart(2, '0')}`,
      objectId: null,
      launchBatch: null,
      inclination: sh.inc,
      shell: s.shell,
      shellName: sh.name,
      perigeeKm: sh.altKm,
      apogeeKm: sh.altKm,
      eccentricity: 0,
      lifecycle: 'operational',
      r: s.r,
      g: s.g,
      b: s.b,
      epoch,
    };
  }

  const catalog: StarlinkCatalogPayload = {
    count,
    referenceTime: epoch,
    tleFetchedAt: liveCatalog?.tleFetchedAt ?? epoch,
    satellites: meta,
    lat,
    lon,
    altKm,
    velLat: new Array(count).fill(0),
    velLon: new Array(count).fill(0),
    velAlt: new Array(count).fill(0),
    ommMeanMotion,
    ommRaan,
    ommArgPerigee,
    ommMeanAnomaly,
    ommBstar: new Array(count).fill(0),
    ommMeanMotionDot: new Array(count).fill(0),
    ommMeanMotionDdot: new Array(count).fill(0),
    ommElementSetNo: new Array(count).fill(999),
    fetchedAt: liveCatalog?.fetchedAt ?? epoch,
  };

  const satrecs = buildSatrecCache(catalog);
  for (let i = 0; i < count; i++) {
    const pos = propagateCatalogIndex(catalog, i, epochDate, satrecs[i]);
    if (pos) {
      lat[i] = pos.lat;
      lon[i] = pos.lon;
      altKm[i] = pos.altKm;
    }
  }

  return catalog;
}

export function linearExtrapolate(
  catalog: StarlinkCatalogPayload,
  index: number,
  whenMs: number
): GeodeticPosition {
  const refMs = Date.parse(catalog.referenceTime);
  const elapsedSec = Number.isFinite(refMs) ? (whenMs - refMs) / 1000 : 0;
  let lat = catalog.lat[index]! + catalog.velLat[index]! * elapsedSec;
  let lon = catalog.lon[index]! + catalog.velLon[index]! * elapsedSec;
  const altKm = catalog.altKm[index]! + catalog.velAlt[index]! * elapsedSec;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return { lat, lon, altKm };
}

export function propagateGeodetic(
  satrec: SatRec,
  when: Date
): GeodeticPosition | null {
  try {
    const pv = propagate(satrec, when);
    if (!pv?.position) return null;
    const gd = eciToGeodetic(pv.position, gstime(when));
    return {
      lat: degreesLat(gd.latitude),
      lon: degreesLong(gd.longitude),
      altKm: gd.height,
    };
  } catch {
    return null;
  }
}

export function propagateCatalogIndex(
  catalog: StarlinkCatalogPayload,
  index: number,
  when: Date,
  satrec?: SatRec | null
): GeodeticPosition | null {
  const rec = satrec ?? satrecFromCatalogIndex(catalog, index);
  if (rec) {
    const pos = propagateGeodetic(rec, when);
    if (pos) return pos;
  }
  return linearExtrapolate(catalog, index, when.getTime());
}

export function velocitiesFromCatalogIndex(
  catalog: StarlinkCatalogPayload,
  index: number,
  when: Date,
  satrec?: SatRec | null
): GeodeticVelocity {
  const rec = satrec ?? satrecFromCatalogIndex(catalog, index);
  if (rec) {
    const pos = propagateGeodetic(rec, when);
    const later = propagateGeodetic(rec, new Date(when.getTime() + 1000));
    if (pos && later) {
      let dLon = later.lon - pos.lon;
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      return {
        velLat: later.lat - pos.lat,
        velLon: dLon,
        velAlt: later.altKm - pos.altKm,
      };
    }
  }

  return {
    velLat: catalog.velLat[index] ?? 0,
    velLon: catalog.velLon[index] ?? 0,
    velAlt: catalog.velAlt[index] ?? 0,
  };
}
