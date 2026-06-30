import {
  getTrackedStarlinkCatalog,
  groundSpeedKms,
  launchBatchFromObjectId,
  perigeeKmFromOmm,
  apogeeKmFromOmm,
  SHELL_BANDS,
  type StarlinkLifecycle,
} from './orbitalStarlink.js';
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
} from 'satellite.js';

export interface StarlinkSatelliteDetail {
  noradId: number;
  name: string;
  objectId: string | null;
  launchBatch: string | null;
  shellName: string;
  inclination: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  perigeeKm: number;
  apogeeKm: number;
  eccentricity: number;
  lifecycle: StarlinkLifecycle;
  groundSpeedKms: number;
  verticalSpeedKms: number;
  epoch: string;
  epochAgeHours: number;
  referenceTime: string;
}

function epochAgeHours(epoch: string, now = Date.now()): number {
  const t = Date.parse(epoch);
  if (!Number.isFinite(t)) return 0;
  return Math.round(Math.max(0, (now - t) / 3_600_000) * 10) / 10;
}

export async function getStarlinkSatelliteByNorad(
  noradId: number
): Promise<StarlinkSatelliteDetail | null> {
  const { sats } = await getTrackedStarlinkCatalog();
  const sat = sats.find((s) => s.omm.NORAD_CAT_ID === noradId);
  if (!sat) return null;

  const when = new Date();
  const pv = propagate(sat.satrec, when);
  if (!pv?.position) return null;

  const gmst = gstime(when);
  const gd = eciToGeodetic(pv.position, gmst);
  const lat = degreesLat(gd.latitude);
  const lon = degreesLong(gd.longitude);
  const altKm = Math.round(gd.height * 10) / 10;

  const later = new Date(when.getTime() + 60_000);
  const pvLater = propagate(sat.satrec, later);
  let velLat = 0;
  let velLon = 0;
  let velAlt = 0;
  if (pvLater?.position) {
    const gdLater = eciToGeodetic(pvLater.position, gstime(later));
    const latLater = degreesLat(gdLater.latitude);
    let lonLater = degreesLong(gdLater.longitude);
    let dLon = lonLater - lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    velLat = (latLater - lat) / 60;
    velLon = dLon / 60;
    velAlt = (gdLater.height - gd.height) / 60;
  }

  const band = SHELL_BANDS[sat.shell]!;

  return {
    noradId: sat.omm.NORAD_CAT_ID,
    name: sat.omm.OBJECT_NAME,
    objectId: sat.omm.OBJECT_ID ?? null,
    launchBatch: launchBatchFromObjectId(sat.omm.OBJECT_ID),
    shellName: band.name,
    inclination: Math.round(sat.omm.INCLINATION * 100) / 100,
    latitude: Math.round(lat * 1000) / 1000,
    longitude: Math.round(lon * 1000) / 1000,
    altitudeKm: altKm,
    perigeeKm: Math.round(perigeeKmFromOmm(sat.omm) * 10) / 10,
    apogeeKm: Math.round(apogeeKmFromOmm(sat.omm) * 10) / 10,
    eccentricity: Math.round((sat.omm.ECCENTRICITY ?? 0) * 1_000_000) / 1_000_000,
    lifecycle: sat.lifecycle,
    groundSpeedKms: Math.round(groundSpeedKms(lat, velLat, velLon, velAlt) * 100) / 100,
    verticalSpeedKms: Math.round(velAlt * 1000) / 1000,
    epoch: sat.omm.EPOCH,
    epochAgeHours: epochAgeHours(sat.omm.EPOCH),
    referenceTime: when.toISOString(),
  };
}

export async function searchStarlinkSatellites(
  query: string,
  limit = 12
): Promise<StarlinkSatelliteDetail[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { sats } = await getTrackedStarlinkCatalog();
  const noradQuery = /^\d+$/.test(q) ? Number(q) : null;
  const matches: typeof sats = [];

  for (const sat of sats) {
    if (noradQuery != null) {
      if (String(sat.omm.NORAD_CAT_ID).includes(q)) matches.push(sat);
    } else if (
      sat.omm.OBJECT_NAME.toLowerCase().includes(q) ||
      sat.omm.OBJECT_ID?.toLowerCase().includes(q)
    ) {
      matches.push(sat);
    }
    if (matches.length >= limit * 3) break;
  }

  const results: StarlinkSatelliteDetail[] = [];
  for (const sat of matches.slice(0, limit)) {
    const detail = await getStarlinkSatelliteByNorad(sat.omm.NORAD_CAT_ID);
    if (detail) results.push(detail);
  }
  return results;
}
