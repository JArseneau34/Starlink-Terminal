import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  type SatRec,
} from 'satellite.js';
import { getCached, setCache } from '../cache.js';

const SSA_CACHE_TTL = 5 * 60_000;
const CELESTRAK_HEADERS = { 'User-Agent': 'SPCX-Terminal/1.0' };
const DEBRIS_URL = 'https://celestrak.org/NORAD/elements/gp.php?NAME=DEB&FORMAT=JSON';
const DECAYING_URL = 'https://celestrak.org/NORAD/elements/gp.php?SPECIAL=DECAYING&FORMAT=JSON';

const ALTITUDE_BANDS = [
  { minKm: 200, maxKm: 400, label: '200–400 km' },
  { minKm: 400, maxKm: 600, label: '400–600 km' },
  { minKm: 600, maxKm: 800, label: '600–800 km' },
  { minKm: 800, maxKm: 1000, label: '800–1000 km' },
  { minKm: 1000, maxKm: 1400, label: '1000–1400 km' },
  { minKm: 1400, maxKm: 2000, label: '1400–2000 km' },
];

interface OmmRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  BSTAR: number;
}

export interface DebrisObject {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  inclination: number;
  epoch: string;
}

export interface AltitudeBand {
  minKm: number;
  maxKm: number;
  label: string;
  count: number;
  densityIndex: number;
}

export interface ConjunctionAlert {
  id: string;
  primaryName: string;
  primaryNorad: number;
  secondaryName: string;
  secondaryNorad: number;
  minRangeKm: number;
  probability: number;
  tca: string;
  relativeSpeedKms: number;
  primaryLat: number;
  primaryLon: number;
  primaryAltKm: number;
  secondaryLat: number;
  secondaryLon: number;
  secondaryAltKm: number;
}

export interface ReentryForecast {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  windowStart: string;
  windowEnd: string;
  perigeeKm: number;
  inclination: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SsaPayload {
  debris: DebrisObject[];
  otherObjects: DebrisObject[];
  densityBands: AltitudeBand[];
  conjunctions: ConjunctionAlert[];
  reentries: ReentryForecast[];
  fetchedAt: string;
}

interface TrackedObject {
  omm: OmmRecord;
  satrec: SatRec;
}

async function fetchOmmList(url: string): Promise<OmmRecord[]> {
  const res = await fetch(url, {
    headers: CELESTRAK_HEADERS,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`CelesTrak fetch failed: ${res.status}`);
  const data = (await res.json()) as OmmRecord[];
  return Array.isArray(data) ? data : [];
}

function positionAt(satrec: SatRec, date: Date): { lat: number; lon: number; altKm: number } | null {
  try {
    const pv = propagate(satrec, date);
    if (!pv || !pv.position) return null;
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

function perigeeKm(omm: OmmRecord): number {
  const nRadPerSec = (omm.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.pow(398600.4418 / (nRadPerSec * nRadPerSec), 1 / 3);
  return a * (1 - omm.ECCENTRICITY) - 6378.137;
}

function apogeeKm(omm: OmmRecord): number {
  const nRadPerSec = (omm.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.pow(398600.4418 / (nRadPerSec * nRadPerSec), 1 / 3);
  return a * (1 + omm.ECCENTRICITY) - 6378.137;
}

function meanAltitudeKm(omm: OmmRecord): number {
  return (perigeeKm(omm) + apogeeKm(omm)) / 2;
}

function toTracked(omm: OmmRecord): TrackedObject | null {
  try {
    return { omm, satrec: json2satrec(omm) };
  } catch {
    return null;
  }
}

function distanceKm(
  a: { lat: number; lon: number; altKm: number },
  b: { lat: number; lon: number; altKm: number }
): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const surface = 2 * r * Math.asin(Math.sqrt(h));
  const dAlt = b.altKm - a.altKm;
  return Math.sqrt(surface * surface + dAlt * dAlt);
}

function buildDensityBands(objects: TrackedObject[]): AltitudeBand[] {
  const counts = ALTITUDE_BANDS.map(() => 0);

  for (const obj of objects) {
    const alt = meanAltitudeKm(obj.omm);
    for (let i = 0; i < ALTITUDE_BANDS.length; i++) {
      const band = ALTITUDE_BANDS[i]!;
      if (alt >= band.minKm && alt < band.maxKm) {
        counts[i]!++;
        break;
      }
    }
  }

  const maxCount = Math.max(1, ...counts);
  return ALTITUDE_BANDS.map((band, i) => ({
    ...band,
    count: counts[i]!,
    densityIndex: counts[i]! / maxCount,
  }));
}

function screenConjunctions(tracked: TrackedObject[], maxAlerts = 10): ConjunctionAlert[] {
  const sample = tracked.slice(0, 96);
  const now = Date.now();
  const candidates: ConjunctionAlert[] = [];

  for (let t = 0; t <= 6; t++) {
    const when = new Date(now + t * 24 * 60 * 60 * 1000);
    const positions = sample
      .map((obj) => {
        const pos = positionAt(obj.satrec, when);
        return pos ? { obj, pos } : null;
      })
      .filter((p): p is { obj: TrackedObject; pos: { lat: number; lon: number; altKm: number } } => !!p);

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const range = distanceKm(a.pos, b.pos);
        if (range > 75) continue;

        const relSpeed = 3.5 + Math.abs(a.obj.omm.INCLINATION - b.obj.omm.INCLINATION) * 0.15;
        const probability = Math.min(0.28, Math.max(0.0002, (75 - range) / 400));

        candidates.push({
          id: `${a.obj.omm.NORAD_CAT_ID}-${b.obj.omm.NORAD_CAT_ID}-${t}`,
          primaryName: a.obj.omm.OBJECT_NAME,
          primaryNorad: a.obj.omm.NORAD_CAT_ID,
          secondaryName: b.obj.omm.OBJECT_NAME,
          secondaryNorad: b.obj.omm.NORAD_CAT_ID,
          minRangeKm: Math.round(range * 100) / 100,
          probability: Math.round(probability * 10000) / 10000,
          tca: when.toISOString(),
          relativeSpeedKms: Math.round(relSpeed * 100) / 100,
          primaryLat: a.pos.lat,
          primaryLon: a.pos.lon,
          primaryAltKm: Math.round(a.pos.altKm),
          secondaryLat: b.pos.lat,
          secondaryLon: b.pos.lon,
          secondaryAltKm: Math.round(b.pos.altKm),
        });
      }
    }
  }

  const deduped = new Map<string, ConjunctionAlert>();
  for (const c of candidates.sort((a, b) => a.minRangeKm - b.minRangeKm)) {
    const key = `${Math.min(c.primaryNorad, c.secondaryNorad)}-${Math.max(c.primaryNorad, c.secondaryNorad)}`;
    if (!deduped.has(key)) deduped.set(key, c);
  }

  return [...deduped.values()].slice(0, maxAlerts);
}

function buildReentries(decaying: TrackedObject[]): ReentryForecast[] {
  const now = Date.now();

  return decaying
    .map((obj) => {
      const perigee = perigeeKm(obj.omm);
      if (perigee > 220) return null;

      const pos = positionAt(obj.satrec, new Date());
      if (!pos) return null;

      const hoursOut = perigee < 120 ? 36 : perigee < 160 ? 72 : 120;
      const windowStart = new Date(now + hoursOut * 0.4 * 3600_000);
      const windowEnd = new Date(now + hoursOut * 3600_000);

      const confidence: ReentryForecast['confidence'] =
        perigee < 130 ? 'high' : perigee < 170 ? 'medium' : 'low';

      return {
        noradId: obj.omm.NORAD_CAT_ID,
        name: obj.omm.OBJECT_NAME,
        latitude: pos.lat,
        longitude: pos.lon,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        perigeeKm: Math.round(perigee * 10) / 10,
        inclination: Math.round(obj.omm.INCLINATION * 10) / 10,
        confidence,
      };
    })
    .filter((r): r is ReentryForecast => !!r)
    .sort((a, b) => a.perigeeKm - b.perigeeKm)
    .slice(0, 12);
}

function orbitPeriodMs(meanMotion: number): number {
  return 86_400_000 / meanMotion;
}

function phasedPosition(
  obj: TrackedObject,
  baseTime: Date
): { lat: number; lon: number; altKm: number } | null {
  const periodMs = orbitPeriodMs(obj.omm.MEAN_MOTION);
  const phaseMs = (obj.omm.NORAD_CAT_ID * 7919) % Math.max(periodMs * 0.9, 90_000);
  return positionAt(obj.satrec, new Date(baseTime.getTime() + phaseMs));
}

function stratifiedPick(tracked: TrackedObject[], limit: number): TrackedObject[] {
  const bins = new Map<string, TrackedObject[]>();

  for (const obj of tracked) {
    const alt = meanAltitudeKm(obj.omm);
    if (alt < 150 || alt > 2200) continue;
    const incBin = Math.floor(obj.omm.INCLINATION / 10);
    const altBin = Math.floor(alt / 120);
    const key = `${incBin}:${altBin}`;
    const list = bins.get(key) ?? [];
    list.push(obj);
    bins.set(key, list);
  }

  const picked: TrackedObject[] = [];
  const keys = [...bins.keys()];
  let round = 0;

  while (picked.length < limit && keys.length > 0) {
    const key = keys[round % keys.length]!;
    const list = bins.get(key)!;
    if (list.length === 0) {
      bins.delete(key);
      keys.splice(keys.indexOf(key), 1);
      round = 0;
      continue;
    }
    const idx = (round * 37 + list.length) % list.length;
    picked.push(list.splice(idx, 1)[0]!);
    round++;
  }

  return picked;
}

function toDebrisObject(obj: TrackedObject, baseTime: Date): DebrisObject | null {
  const pos = phasedPosition(obj, baseTime);
  if (!pos || pos.altKm < 150 || pos.altKm > 2200) return null;

  return {
    noradId: obj.omm.NORAD_CAT_ID,
    name: obj.omm.OBJECT_NAME,
    latitude: Math.round(pos.lat * 100) / 100,
    longitude: Math.round(pos.lon * 100) / 100,
    altitudeKm: Math.round(pos.altKm),
    inclination: Math.round(obj.omm.INCLINATION * 10) / 10,
    epoch: obj.omm.EPOCH,
  };
}

function buildDebrisPoints(tracked: TrackedObject[], limit = 200): DebrisObject[] {
  const now = new Date();
  const picked = stratifiedPick(tracked, limit * 2);
  const debris: DebrisObject[] = [];

  for (const obj of picked) {
    if (debris.length >= limit) break;
    const point = toDebrisObject(obj, now);
    if (point) debris.push(point);
  }

  return debris;
}

function buildOtherObjects(tracked: TrackedObject[], limit = 90): DebrisObject[] {
  const candidates = tracked.filter((obj) => perigeeKm(obj.omm) > 220);
  const picked = stratifiedPick(candidates, limit * 2);
  const now = new Date();
  const objects: DebrisObject[] = [];

  for (const obj of picked) {
    if (objects.length >= limit) break;
    const point = toDebrisObject(obj, now);
    if (point) objects.push(point);
  }

  return objects;
}

export async function buildSsaPayload(): Promise<SsaPayload> {
  const cached = getCached<SsaPayload>('ssa:global:v3');
  if (cached) return cached;

  const [debrisRaw, decayingRaw] = await Promise.all([
    fetchOmmList(DEBRIS_URL),
    fetchOmmList(DECAYING_URL),
  ]);

  const leoDebris = debrisRaw
    .filter((o) => o.MEAN_MOTION > 10.5 && o.MEAN_MOTION < 16.5)
    .slice(0, 400);

  const trackedDebris = leoDebris
    .map(toTracked)
    .filter((o): o is TrackedObject => !!o);

  const trackedDecaying = decayingRaw
    .map(toTracked)
    .filter((o): o is TrackedObject => !!o);

  const densitySource = trackedDebris.length > 0 ? trackedDebris : trackedDecaying;
  const debris = buildDebrisPoints(trackedDebris.length > 0 ? trackedDebris : trackedDecaying);
  const payload: SsaPayload = {
    debris,
    otherObjects: buildOtherObjects(trackedDecaying),
    densityBands: buildDensityBands(densitySource),
    conjunctions: screenConjunctions(trackedDebris.length > 0 ? trackedDebris : trackedDecaying),
    reentries: buildReentries(trackedDecaying),
    fetchedAt: new Date().toISOString(),
  };

  setCache('ssa:global:v3', payload, SSA_CACHE_TTL);
  return payload;
}
