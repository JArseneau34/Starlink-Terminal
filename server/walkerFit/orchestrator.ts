import path from 'node:path';

import fs from 'node:fs';

import { buildWalkerFitPayload } from '../../src/walkerFit/buildFeed.ts';

import type { WalkerFitInputSat, WalkerFitPayload } from '../../src/walkerFit/types.ts';

import { classifyOrbitalShell } from '../../src/data/orbitalShellClassification.ts';

import {
  classifyStarlinkLifecycle,
  meanAltitudeKmFromOmm,
  orbitSnapshotFromOmm,
} from '../../src/data/starlinkOrbitOmm.ts';
import { getTrackedStarlinkCatalog } from '../services/orbitalStarlink.js';
import type { TrackedStarlinkSat } from '../services/orbitalStarlink.js';
import { resolveFleetSnapshot } from '../services/pipelineFleet.js';
import { sanitizeFleetSnapshotDate } from '../../src/utils/fleetSnapshotDate.ts';



export const WALKER_FIT_CACHE_PATH =

  process.env.WALKER_FIT_CACHE_PATH ?? '.cache/starlink/walker-fit.json';



export const WALKER_FIT_PUBLIC_PATH =

  process.env.WALKER_FIT_PUBLIC_PATH ?? 'public/orbital/walker-fit.json';



let memoryCache: { payload: WalkerFitPayload; builtAt: number } | null = null;



function toInputSat(row: TrackedStarlinkSat): WalkerFitInputSat {

  const omm = row.omm;

  const orbit = orbitSnapshotFromOmm(omm);

  const lifecycle = classifyStarlinkLifecycle(orbit);

  const assignment = classifyOrbitalShell(orbit, lifecycle, {
    raanDeg: Number(omm.RA_OF_ASC_NODE ?? 0),
    argPerDeg: Number(omm.ARG_OF_PERICENTER ?? 0),
    meanAnomalyDeg: Number(omm.MEAN_ANOMALY ?? 0),
  });

  return {

    noradId: omm.NORAD_CAT_ID,

    name: omm.OBJECT_NAME,

    inclination: omm.INCLINATION,

    meanAltKm: meanAltitudeKmFromOmm(omm),

    raanDeg: Number(omm.RA_OF_ASC_NODE ?? 0),

    argPerDeg: Number(omm.ARG_OF_PERICENTER ?? 0),

    meanAnomalyDeg: Number(omm.MEAN_ANOMALY ?? 0),

    meanMotion: omm.MEAN_MOTION,

    epoch: omm.EPOCH,

    eccentricity: Number(omm.ECCENTRICITY ?? 0),

    lifecycle: row.lifecycle,

    structuralIndex: assignment.structuralIndex,

    isTransit: assignment.isTransit,

  };

}



export async function computeWalkerFitPayload(): Promise<WalkerFitPayload> {
  const [catalog, fleet] = await Promise.all([
    getTrackedStarlinkCatalog(),
    resolveFleetSnapshot(),
  ]);
  const snapshotDate = sanitizeFleetSnapshotDate(fleet.fleet.snapshotDate);
  const referenceTime = `${snapshotDate}T12:00:00.000Z`;
  const tleFetchedAt = new Date(catalog.fetchedAt).toISOString();
  const inputs = catalog.sats.map(toInputSat);

  return buildWalkerFitPayload(
    inputs,
    referenceTime,
    tleFetchedAt,
    fleet.fleet.totalWorking,
    snapshotDate
  );
}



export async function refreshWalkerFitCache(): Promise<WalkerFitPayload> {

  const payload = await computeWalkerFitPayload();

  memoryCache = { payload, builtAt: Date.now() };

  return payload;

}



export function readWalkerFitFromDisk(): WalkerFitPayload | null {

  try {

    if (!fs.existsSync(WALKER_FIT_CACHE_PATH)) return null;

    return JSON.parse(fs.readFileSync(WALKER_FIT_CACHE_PATH, 'utf8')) as WalkerFitPayload;

  } catch {

    return null;

  }

}



export async function getWalkerFitPayload(): Promise<WalkerFitPayload> {

  if (memoryCache) return memoryCache.payload;

  const disk = readWalkerFitFromDisk();

  if (disk) {

    memoryCache = { payload: disk, builtAt: Date.now() };

    return disk;

  }

  return refreshWalkerFitCache();

}



export function publishWalkerFitJson(payload: WalkerFitPayload): void {

  const json = JSON.stringify(payload, null, 2);

  const cacheDir = path.dirname(WALKER_FIT_CACHE_PATH);

  fs.mkdirSync(cacheDir, { recursive: true });

  fs.writeFileSync(WALKER_FIT_CACHE_PATH, json, 'utf8');



  const publicDir = path.dirname(WALKER_FIT_PUBLIC_PATH);

  fs.mkdirSync(publicDir, { recursive: true });

  fs.writeFileSync(WALKER_FIT_PUBLIC_PATH, json, 'utf8');

  memoryCache = { payload, builtAt: Date.now() };

}



export async function updateAndPublishWalkerFit(): Promise<WalkerFitPayload> {

  const payload = await refreshWalkerFitCache();

  publishWalkerFitJson(payload);

  return payload;

}


