import type { StarlinkCatalogPayload, StarlinkSatelliteDetail } from '../types/orbital';
import type { SatRec } from 'satellite.js';
import {
  propagateCatalogIndex,
  velocitiesFromCatalogIndex,
} from './starlinkPropagation';

function epochAgeHours(epoch: string, now = Date.now()): number {
  const t = Date.parse(epoch);
  if (!Number.isFinite(t)) return 0;
  return Math.round(Math.max(0, (now - t) / 3_600_000) * 10) / 10;
}

function groundSpeedKms(
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

export function detailFromCatalogIndex(
  catalog: StarlinkCatalogPayload,
  index: number,
  when: Date = new Date(),
  satrec?: SatRec | null
): StarlinkSatelliteDetail | null {
  const meta = catalog.satellites[index];
  if (!meta) return null;

  const pos = propagateCatalogIndex(catalog, index, when, satrec);
  if (!pos) return null;

  const { velLat, velLon, velAlt } = velocitiesFromCatalogIndex(
    catalog,
    index,
    when,
    satrec
  );

  const lat = Math.round(pos.lat * 1000) / 1000;
  const lon = Math.round(pos.lon * 1000) / 1000;
  const altKm = Math.round(pos.altKm * 10) / 10;

  return {
    noradId: meta.noradId,
    name: meta.name,
    objectId: meta.objectId,
    launchBatch: meta.launchBatch,
    shellName: meta.shellName,
    inclination: meta.inclination,
    latitude: lat,
    longitude: lon,
    altitudeKm: altKm,
    perigeeKm: meta.perigeeKm,
    apogeeKm: meta.apogeeKm,
    eccentricity: meta.eccentricity,
    lifecycle: meta.lifecycle,
    groundSpeedKms: Math.round(groundSpeedKms(lat, velLat, velLon, velAlt) * 100) / 100,
    verticalSpeedKms: Math.round(velAlt * 1000) / 1000,
    epoch: meta.epoch,
    epochAgeHours: epochAgeHours(meta.epoch, when.getTime()),
    referenceTime: when.toISOString(),
  };
}

export function findCatalogIndex(
  catalog: StarlinkCatalogPayload,
  query: string
): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  if (/^\d+$/.test(q)) {
    const norad = Number(q);
    const idx = catalog.satellites.findIndex((s) => s.noradId === norad);
    return idx >= 0 ? idx : null;
  }

  const idx = catalog.satellites.findIndex(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.objectId?.toLowerCase().includes(q) ||
      s.launchBatch?.includes(q)
  );
  return idx >= 0 ? idx : null;
}

export async function fetchSatelliteDetail(noradId: number): Promise<StarlinkSatelliteDetail | null> {
  const res = await fetch(`/api/orbital/starlink/sat/${noradId}`);
  if (!res.ok) return null;
  return res.json() as Promise<StarlinkSatelliteDetail>;
}

export async function searchSatellites(query: string): Promise<StarlinkSatelliteDetail[]> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`/api/orbital/starlink/search?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results: StarlinkSatelliteDetail[] };
  return data.results ?? [];
}
