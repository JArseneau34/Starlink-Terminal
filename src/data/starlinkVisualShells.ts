/**
 * Visual shell categories for live CelesTrak catalog display and filtering.
 *
 * Distinct from Walker topology shells in starlinkShells.ts — those drive ISL grid
 * geometry only. Visual shells classify real TLEs by generation, orbit family,
 * lifecycle, and optional hardware hints.
 */

import {
  classifyStarlinkLifecycle,
  launchYearFromObjectId,
  orbitSnapshotFromOmm,
  type OrbitSnapshot,
  type StarlinkLifecycle,
} from './starlinkOrbitOmm';

export interface StarlinkOmmForClassification {
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  INCLINATION: number;
  MEAN_MOTION: number;
  ECCENTRICITY?: number;
}

export type StarlinkModelHint =
  | 'v1'
  | 'v15'
  | 'v2Mini'
  | 'v2MiniDtc'
  | 'v2MiniOpt'
  | 'unknown';

/** Live catalog display bucket — not Walker plane×slot topology. */
export interface VisualShellSpec {
  index: number;
  name: string;
  color: number;
  /** Representative inclination for summaries and legends. */
  nominalInc: number;
}

export const VISUAL_SHELL_SPECS: VisualShellSpec[] = [
  { index: 0, name: 'Gen1-I', color: 0x3de8ff, nominalInc: 53.0 },
  { index: 1, name: 'Gen1-II', color: 0x22c9e8, nominalInc: 53.0 },
  { index: 2, name: 'Gen1-Transit', color: 0x94a3b8, nominalInc: 53.0 },
  { index: 3, name: 'Gen2', color: 0x2ee86a, nominalInc: 53.2 },
  { index: 4, name: 'Gen2-Transit', color: 0xf59e0b, nominalInc: 53.2 },
  { index: 5, name: 'Polar', color: 0xa78bfa, nominalInc: 70.0 },
  { index: 6, name: 'SSO Shell 1', color: 0xff6bd6, nominalInc: 97.6 },
  { index: 7, name: 'SSO Shell 2', color: 0xe879f9, nominalInc: 97.4 },
  { index: 8, name: 'Other', color: 0x64748b, nominalInc: 0 },
];

export const VISUAL_SHELL_COUNT = VISUAL_SHELL_SPECS.length;

export interface VisualShellAssignment {
  shellIndex: number;
  shellName: string;
  lifecycle: StarlinkLifecycle;
  modelHint: StarlinkModelHint;
  orbit: OrbitSnapshot;
  /** Lower is a better multi-factor match (legacy field; rule-based assigns 0). */
  matchScore: number;
}

function incNear(inc: number, target: number, tolDeg: number): boolean {
  return Math.abs(inc - target) <= tolDeg;
}

function isV2Name(name: string): boolean {
  return /\bDTC\b/.test(name) || /DIRECT.?TO.?CELL/i.test(name) || /\bOPT\b/.test(name) || /OPTIMIZED/i.test(name);
}

export function inferModelHint(
  omm: Pick<StarlinkOmmForClassification, 'OBJECT_NAME' | 'OBJECT_ID' | 'INCLINATION'>,
  orbit: OrbitSnapshot
): StarlinkModelHint {
  const name = omm.OBJECT_NAME.toUpperCase();
  const launchYear = launchYearFromObjectId(omm.OBJECT_ID);
  const inc = orbit.inclination;
  const alt = orbit.meanAltKm;

  if (/\bDTC\b/.test(name) || /DIRECT.?TO.?CELL/i.test(name)) {
    return 'v2MiniDtc';
  }
  if (/\bOPT\b/.test(name) || /OPTIMIZED/i.test(name)) {
    return 'v2MiniOpt';
  }

  if (incNear(inc, 70, 1.2) || inc >= 97) {
    return launchYear != null && launchYear < 2020 ? 'v1' : 'v15';
  }

  if (launchYear != null && launchYear < 2020) {
    return 'v1';
  }

  if (launchYear != null && launchYear < 2021) {
    return 'v15';
  }

  if (incNear(inc, 53.2, 0.3) || incNear(inc, 43, 1) || incNear(inc, 33, 1)) {
    return 'v2Mini';
  }

  if (incNear(inc, 53, 0.35) && alt < 535) {
    return 'v2Mini';
  }

  if (launchYear != null && launchYear >= 2021) {
    return isV2Name(name) ? 'v2MiniOpt' : 'v2Mini';
  }

  return 'unknown';
}

function isGen2Model(modelHint: StarlinkModelHint): boolean {
  return modelHint === 'v2Mini' || modelHint === 'v2MiniDtc' || modelHint === 'v2MiniOpt';
}

function isTransitLifecycle(lifecycle: StarlinkLifecycle): boolean {
  return lifecycle === 'raising' || lifecycle === 'deorbiting';
}

/** First operational V2 mini launch (Group 6-1) was 2023-02-27 — the gen1/gen2 epoch boundary. */
const GEN2_FIRST_LAUNCH_YEAR = 2023;
/** v1.0 → v1.5 hardware transition fell across 2021. */
const GEN1_V10_LAST_YEAR = 2020;

const VISUAL_SHELL = {
  gen1I: 0,
  gen1II: 1,
  gen1Transit: 2,
  gen2: 3,
  gen2Transit: 4,
  polar: 5,
  sso1: 6,
  sso2: 7,
  other: 8,
} as const;

/** True for the sun-synchronous / polar inclination families (97°+). */
function ssoShellIndex(inc: number): number | null {
  if (inc >= 97.45 && inc <= 98.0) return VISUAL_SHELL.sso1;
  if (inc >= 96.5 && inc < 97.45) return VISUAL_SHELL.sso2;
  return null;
}

/** Decide gen1 vs gen2 from the strongest available signal: model hint, then launch epoch. */
function isGen2(modelHint: StarlinkModelHint, launchYear: number | null, inc: number): boolean {
  if (isGen2Model(modelHint)) return true;
  // 43° and 33° shells are exclusively V2 mini (gen2).
  if (incNear(inc, 43, 1.5) || incNear(inc, 33, 1.5)) return true;
  if (launchYear != null) return launchYear >= GEN2_FIRST_LAUNCH_YEAR;
  // No epoch — fall back to the 53.2° gen2 shell vs 53.0° gen1 shell split.
  return inc >= 53.15;
}

function gen1OperationalIndex(launchYear: number | null, modelHint: StarlinkModelHint): number {
  if (modelHint === 'v1') return VISUAL_SHELL.gen1I;
  if (modelHint === 'v15') return VISUAL_SHELL.gen1II;
  if (launchYear != null && launchYear <= GEN1_V10_LAST_YEAR) return VISUAL_SHELL.gen1I;
  return VISUAL_SHELL.gen1II;
}

/**
 * Classify a live TLE into a mission/orbit-state display bucket.
 *
 * Generation (gen1 vs gen2) is driven primarily by launch epoch and model hint
 * because the 53.0° (gen1) and 53.2° (gen2) shells differ by only ~0.2°.
 */
export function classifyVisualShell(omm: StarlinkOmmForClassification): VisualShellAssignment {
  const orbit = orbitSnapshotFromOmm(omm);
  const lifecycle = classifyStarlinkLifecycle(orbit);
  const modelHint = inferModelHint(omm, orbit);
  const launchYear = launchYearFromObjectId(omm.OBJECT_ID);
  const inc = orbit.inclination;

  let shellIndex: number = VISUAL_SHELL.other;

  const sso = ssoShellIndex(inc);
  const isPolar = incNear(inc, 70, 1.5);
  const gen2 = isGen2(modelHint, launchYear, inc);

  if (sso != null) {
    // SSO/polar-sun-sync sats keep their shell identity through transit.
    shellIndex = sso;
  } else if (isPolar) {
    shellIndex = VISUAL_SHELL.polar;
  } else if (isTransitLifecycle(lifecycle)) {
    shellIndex = gen2 ? VISUAL_SHELL.gen2Transit : VISUAL_SHELL.gen1Transit;
  } else if (lifecycle === 'operational') {
    if (incNear(inc, 53, 0.6) || incNear(inc, 43, 1.5) || incNear(inc, 33, 1.5)) {
      shellIndex = gen2 ? VISUAL_SHELL.gen2 : gen1OperationalIndex(launchYear, modelHint);
    }
  }

  const shell = VISUAL_SHELL_SPECS[shellIndex]!;

  return {
    shellIndex,
    shellName: shell.name,
    lifecycle,
    modelHint,
    orbit,
    matchScore: 0,
  };
}
