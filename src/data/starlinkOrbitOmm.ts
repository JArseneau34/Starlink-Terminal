/**
 * Orbital element helpers for live CelesTrak OMM records.
 * Shared by visual shell classification and server propagation.
 */

export interface StarlinkOmmElements {
  MEAN_MOTION: number;
  INCLINATION: number;
  ECCENTRICITY?: number;
}

export type StarlinkLifecycle = 'operational' | 'raising' | 'deorbiting' | 'other';

const EARTH_MU_KM = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;

export function semiMajorAxisKm(meanMotionRevPerDay: number): number {
  const nRadPerSec = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  return Math.pow(EARTH_MU_KM / (nRadPerSec * nRadPerSec), 1 / 3);
}

export function perigeeKmFromOmm(omm: StarlinkOmmElements): number {
  const a = semiMajorAxisKm(omm.MEAN_MOTION);
  return a * (1 - (omm.ECCENTRICITY ?? 0)) - EARTH_RADIUS_KM;
}

export function apogeeKmFromOmm(omm: StarlinkOmmElements): number {
  const a = semiMajorAxisKm(omm.MEAN_MOTION);
  return a * (1 + (omm.ECCENTRICITY ?? 0)) - EARTH_RADIUS_KM;
}

export function meanAltitudeKmFromOmm(omm: StarlinkOmmElements): number {
  return (perigeeKmFromOmm(omm) + apogeeKmFromOmm(omm)) / 2;
}

export interface OrbitSnapshot {
  perigeeKm: number;
  apogeeKm: number;
  meanAltKm: number;
  eccentricity: number;
  inclination: number;
}

export function orbitSnapshotFromOmm(omm: StarlinkOmmElements): OrbitSnapshot {
  const perigeeKm = perigeeKmFromOmm(omm);
  const apogeeKm = apogeeKmFromOmm(omm);
  return {
    perigeeKm,
    apogeeKm,
    meanAltKm: (perigeeKm + apogeeKm) / 2,
    eccentricity: omm.ECCENTRICITY ?? 0,
    inclination: omm.INCLINATION,
  };
}

export function classifyStarlinkLifecycle(
  orbit: Pick<OrbitSnapshot, 'perigeeKm' | 'apogeeKm' | 'eccentricity'>
): StarlinkLifecycle {
  const { perigeeKm, apogeeKm, eccentricity: ecc } = orbit;

  if (perigeeKm < 220) return 'deorbiting';
  if (perigeeKm < 350 || (ecc > 0.0015 && perigeeKm < 450)) return 'raising';
  if (perigeeKm >= 350 && perigeeKm <= 600 && apogeeKm <= 650) return 'operational';
  return 'other';
}

export function classifyStarlinkLifecycleFromOmm(
  omm: StarlinkOmmElements
): StarlinkLifecycle {
  return classifyStarlinkLifecycle(orbitSnapshotFromOmm(omm));
}

export function launchYearFromObjectId(objectId: string | undefined): number | null {
  if (!objectId) return null;
  const match = objectId.match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number.parseInt(match[1]!, 10);
  return Number.isFinite(year) ? year : null;
}
