import { json2satrec, propagate } from '../lib/satelliteJsCore';
import type { OMMJsonObject } from 'satellite.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

export function wrapRad(radians: number): number {
  const x = radians % TAU;
  return x < 0 ? x + TAU : x;
}

export function wrapDeltaRad(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

/** Circular distance on RAAN×phase torus (radians). */
export function torusDistance(
  raanA: number,
  phaseA: number,
  raanB: number,
  phaseB: number
): number {
  const dRaan = wrapDeltaRad(raanA, raanB);
  const dPhase = wrapDeltaRad(phaseA, phaseB);
  return Math.hypot(dRaan, dPhase);
}

export interface OmmAngleInput {
  RA_OF_ASC_NODE?: number | string;
  ARG_OF_PERICENTER?: number | string;
  MEAN_ANOMALY?: number | string;
  MEAN_MOTION?: number | string;
  INCLINATION?: number | string;
  ECCENTRICITY?: number | string;
  EPOCH?: string;
  NORAD_CAT_ID?: number;
  OBJECT_NAME?: string;
}

function raanAndArgLatFromState(
  r: { x: number; y: number; z: number },
  v: { x: number; y: number; z: number }
): { raan: number; u: number } | null {
  const { x: rx, y: ry, z: rz } = r;
  const { x: vx, y: vy, z: vz } = v;
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const hMag = Math.hypot(hx, hy, hz);
  if (hMag < 1e-9) return null;

  const inc = Math.acos(Math.max(-1, Math.min(1, hz / hMag)));
  const nx = -hy;
  const ny = hx;
  const nMag = Math.hypot(nx, ny);
  let raan = 0;
  if (nMag > 1e-9) {
    raan = Math.atan2(ny, nx);
    if (raan < 0) raan += TAU;
  }

  const rMag = Math.hypot(rx, ry, rz);
  if (inc < 1e-6) {
    let u = Math.atan2(ry, rx);
    if (u < 0) u += TAU;
    return { raan, u };
  }

  const dotNr = (nx * rx + ny * ry) / (nMag * rMag);
  const cx = ny * hz;
  const cy = -nx * hz;
  const cz = 0;
  const cMag = Math.hypot(cx, cy, cz);
  const dotCr = cMag > 1e-9 ? (cx * rx + cy * ry + cz * rz) / (cMag * rMag) : 0;
  let u = Math.atan2(dotCr, dotNr);
  if (u < 0) u += TAU;
  return { raan, u };
}

/** SGP4 argument of latitude + RAAN at a display epoch (radians). */
export function raanPhaseFromOmmAtEpoch(
  omm: OmmAngleInput,
  when: Date
): { raan: number; phase: number } | null {
  if (
    omm.MEAN_MOTION == null ||
    omm.INCLINATION == null ||
    !omm.EPOCH ||
    !Number.isFinite(omm.MEAN_MOTION) ||
    !Number.isFinite(omm.INCLINATION)
  ) {
    return null;
  }

  try {
    const record: OMMJsonObject = {
      OBJECT_NAME: omm.OBJECT_NAME ?? 'STARLINK',
      OBJECT_ID: '',
      NORAD_CAT_ID: omm.NORAD_CAT_ID ?? 0,
      EPOCH: omm.EPOCH,
      MEAN_MOTION: Number(omm.MEAN_MOTION),
      ECCENTRICITY: Number(omm.ECCENTRICITY ?? 0),
      INCLINATION: Number(omm.INCLINATION),
      RA_OF_ASC_NODE: Number(omm.RA_OF_ASC_NODE ?? 0),
      ARG_OF_PERICENTER: Number(omm.ARG_OF_PERICENTER ?? 0),
      MEAN_ANOMALY: Number(omm.MEAN_ANOMALY ?? 0),
      ELEMENT_SET_NO: 999,
      BSTAR: 0,
      MEAN_MOTION_DOT: 0,
      MEAN_MOTION_DDOT: 0,
      EPHEMERIS_TYPE: 0,
    };
    const satrec = json2satrec(record);
    const pv = propagate(satrec, when);
    if (!pv?.position || !pv.velocity) return null;
    const angles = raanAndArgLatFromState(pv.position, pv.velocity);
    if (!angles) return null;
    return { raan: angles.raan, phase: angles.u };
  } catch {
    return null;
  }
}

/**
 * Invariant RAAN×phase frame for near-circular Walker shells.
 * Prefer SGP4 argument of latitude at epoch; fall back to ω+M mean elements.
 */
export function ommToInvariantRaanPhase(
  raanDeg: number,
  argPerDeg: number,
  meanAnomalyDeg: number,
  omm?: OmmAngleInput | null,
  when?: Date | null
): { raan: number; phase: number } {
  if (omm && when) {
    const propagated = raanPhaseFromOmmAtEpoch(omm, when);
    if (propagated) return propagated;
  }
  return {
    raan: wrapRad(raanDeg * D2R),
    phase: wrapRad((argPerDeg + meanAnomalyDeg) * D2R),
  };
}

export function radiansToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
