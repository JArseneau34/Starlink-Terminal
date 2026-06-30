/**
 * Walker topology shell grids — ISL plane×slot geometry only.
 * Live CelesTrak visual grouping uses starlinkVisualShells.ts (multi-factor classifier).
 */

import { STARLINK_FLEET_SNAPSHOT } from './starlinkFleetSnapshot';

export interface StarlinkShellSpec {
  name: string;
  inc: number;
  planes: number;
  /** Uniform satellites per plane when planeSats is omitted. */
  sats: number;
  altKm: number;
  color: number;
  walkerF?: number;
  planeSats?: number[];
  generation: 'gen1' | 'gen2';
}

/** Topology fleet target — McDowell snapshot total_working (synthetic Walker model only; live mode uses NORAD TLE counts). */
export const TOPOLOGY_FLEET_TARGET = STARLINK_FLEET_SNAPSHOT.totalWorking;

/** Representative Walker grid before proportional scaling to TOPOLOGY_FLEET_TARGET. */
export const STARLINK_SHELL_SPECS_BASE: StarlinkShellSpec[] = [
  {
    name: '53.0°',
    inc: 53.0,
    planes: 108,
    sats: 38,
    altKm: 525,
    color: 0x3de8ff,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '53.2°',
    inc: 53.2,
    planes: 72,
    sats: 26,
    altKm: 530,
    color: 0x2ee86a,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '43.0°',
    inc: 43.0,
    planes: 18,
    sats: 14,
    altKm: 555,
    color: 0xffb84b,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '33.0°',
    inc: 33.0,
    planes: 12,
    sats: 12,
    altKm: 550,
    color: 0xff9a3d,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '70.0°',
    inc: 70.0,
    planes: 36,
    sats: 17,
    altKm: 570,
    color: 0xa78bfa,
    walkerF: 1,
    generation: 'gen1',
  },
  {
    name: '97.6°',
    inc: 97.6,
    planes: 10,
    sats: 52,
    altKm: 600,
    color: 0xff6bd6,
    walkerF: 1,
    generation: 'gen1',
    planeSats: [58, 58, 58, 58, 58, 58, 43, 43, 43, 43],
  },
];

export function shellSatCountFromSpec(sh: StarlinkShellSpec): number {
  if (sh.planeSats?.length === sh.planes) {
    return sh.planeSats.reduce((sum, n) => sum + n, 0);
  }
  return sh.planes * sh.sats;
}

export function distributeSatsAcrossPlanes(planes: number, total: number): number[] {
  const base = Math.floor(total / planes);
  const rem = total % planes;
  return Array.from({ length: planes }, (_, p) => base + (p < rem ? 1 : 0));
}

function scaleShellSpecToCount(sh: StarlinkShellSpec, targetCount: number): StarlinkShellSpec {
  const planeSats = distributeSatsAcrossPlanes(sh.planes, targetCount);
  const uniform = planeSats.every((n) => n === planeSats[0]);
  if (uniform) {
    return { ...sh, sats: planeSats[0]!, planeSats: undefined };
  }
  return { ...sh, planeSats, sats: planeSats[0]! };
}

/** Proportionally scale representative shell grids to an exact fleet total. */
export function scaleShellSpecsToFleetTarget(
  specs: readonly StarlinkShellSpec[],
  targetTotal: number
): StarlinkShellSpec[] {
  const baseCounts = specs.map(shellSatCountFromSpec);
  const baseTotal = baseCounts.reduce((sum, n) => sum + n, 0);
  if (baseTotal <= 0 || targetTotal === baseTotal) {
    return specs.map((sh) => ({ ...sh }));
  }

  const quotas = baseCounts.map((count) => (count / baseTotal) * targetTotal);
  const allocated = quotas.map((q) => Math.floor(q));
  const remainder = targetTotal - allocated.reduce((sum, n) => sum + n, 0);
  const order = quotas
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let r = 0; r < remainder; r++) {
    allocated[order[r % order.length]!.i]!++;
  }

  return specs.map((sh, i) => scaleShellSpecToCount(sh, allocated[i]!));
}

/** Walker topology shells scaled to McDowell total_working. */
export const STARLINK_SHELL_SPECS = scaleShellSpecsToFleetTarget(
  STARLINK_SHELL_SPECS_BASE,
  TOPOLOGY_FLEET_TARGET
);

/** Sum of representative (pre-scale) Walker grid counts. */
export const TOPOLOGY_BASE_TOTAL = STARLINK_SHELL_SPECS_BASE.reduce(
  (sum, sh) => sum + shellSatCountFromSpec(sh),
  0
);

export const TOPOLOGY_MODELED_TOTAL = STARLINK_SHELL_SPECS.reduce(
  (sum, sh) => sum + shellSatCountFromSpec(sh),
  0
);

/** Nearest Walker topology shell by inclination (not live visual categories). */
export function walkerShellIndexForInclination(inc: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < STARLINK_SHELL_SPECS.length; i++) {
    const diff = Math.abs(STARLINK_SHELL_SPECS[i]!.inc - inc);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
