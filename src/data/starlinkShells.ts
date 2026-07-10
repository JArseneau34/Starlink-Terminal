/**
 * Walker topology shell grids — derived from shellReference.ts (FCC authorizations).
 * Live TLE classification uses orbitalShellClassification.ts.
 */

import {
  deriveWalkerGrid,
  formatShellLabel,
  GRANTED_SHELL_REFERENCE,
  GRANTED_TOPOLOGY_TOTAL,
  resolveShellPlanes,
  resolveShellSatsPerPlane,
  SHELL_REFERENCE,
  type ShellReferenceRow,
  type ShellStatus,
} from './shellReference';
import { STARLINK_FLEET_SNAPSHOT } from './starlinkFleetSnapshot';

export type { ConstellationGen, ShellReferenceRow, ShellStatus } from './shellReference';
export {
  GEN1_GRANTED_TOTAL,
  GEN2_GRANTED_TOTAL,
  GRANTED_SHELL_REFERENCE,
  GRANTED_SHELL_COUNT,
  GRANTED_TOPOLOGY_TOTAL,
  isGrantedShellIndex,
  PENDING_SHELL_REFERENCE,
  PENDING_TOPOLOGY_TOTAL,
  SHELL_REFERENCE,
  shellReferenceByIndex,
  grantedShellTotal,
} from './shellReference';

export interface StarlinkShellSpec {
  key: string;
  structuralIndex: number;
  constellationGen: 'gen1' | 'gen2';
  shellId: number;
  name: string;
  inc: number;
  planes: number;
  /** Uniform satellites per plane when planeSats is omitted. */
  sats: number;
  altKm: number;
  color: number;
  walkerF?: number;
  planeSats?: number[];
  status: ShellStatus;
  totalSats: number;
  phasingSource: 'fcc' | 'fitted';
}

export function shellReferenceToSpec(
  row: ShellReferenceRow,
  fittedPhasing?: number | null
): StarlinkShellSpec {
  const planes = resolveShellPlanes(row);
  const uniformSats = resolveShellSatsPerPlane(row, planes);
  const phasingF = fittedPhasing ?? row.phasingF ?? 1;

  let planeSats: number[] | undefined;
  if (row.planes != null && row.satsPerPlane != null) {
    planeSats = distributeSatsAcrossPlanes(planes, row.totalSats);
  } else if (row.planes == null && row.satsPerPlane == null) {
    const derived = deriveWalkerGrid(row.totalSats);
    planeSats = distributeSatsAcrossPlanes(derived.planes, row.totalSats);
  }

  const uniform = !planeSats || planeSats.every((n) => n === planeSats![0]);

  return {
    key: row.key,
    structuralIndex: row.structuralIndex,
    constellationGen: row.constellationGen,
    shellId: row.shellId,
    name: formatShellLabel(row),
    inc: row.incDeg,
    planes: planeSats ? planeSats.length : planes,
    sats: uniform ? (planeSats?.[0] ?? uniformSats) : uniformSats,
    altKm: row.altKm,
    color: row.color,
    walkerF: phasingF,
    planeSats: uniform ? undefined : planeSats,
    status: row.status,
    totalSats: row.totalSats,
    phasingSource: fittedPhasing != null ? 'fitted' : row.source === 'fitted' ? 'fitted' : 'fcc',
  };
}

/** All FCC shells (granted + pending) for ghost lattice rendering. */
export function resolveTopologyShells(fittedPhasing?: Map<string, number>): StarlinkShellSpec[] {
  return SHELL_REFERENCE.map((row) =>
    shellReferenceToSpec(row, fittedPhasing?.get(row.key) ?? null)
  );
}

/** Granted shells only — Walker fit + modeled−live Δ. */
export function resolveGrantedTopologyShells(
  fittedPhasing?: Map<string, number>
): StarlinkShellSpec[] {
  return GRANTED_SHELL_REFERENCE.map((row) =>
    shellReferenceToSpec(row, fittedPhasing?.get(row.key) ?? null)
  );
}

export const STARLINK_SHELL_SPECS = resolveGrantedTopologyShells();
export const STARLINK_SHELL_SPECS_ALL = resolveTopologyShells();

/** McDowell total_working — Walker reference scales to this by default. */
export const TOPOLOGY_FLEET_TARGET = STARLINK_FLEET_SNAPSHOT.totalWorking;

/** @deprecated Use GRANTED_TOPOLOGY_TOTAL for FCC slot capacity. */
export const TOPOLOGY_MODELED_TOTAL = GRANTED_TOPOLOGY_TOTAL;

export function shellSatCountFromSpec(sh: StarlinkShellSpec): number {
  if (sh.planeSats?.length === sh.planes) {
    return sh.planeSats.reduce((sum, n) => sum + n, 0);
  }
  return sh.planes * sh.sats;
}

function scaleShellSpecToCount(sh: StarlinkShellSpec, targetCount: number): StarlinkShellSpec {
  const planeSats = distributeSatsAcrossPlanes(sh.planes, targetCount);
  const uniform = planeSats.every((n) => n === planeSats[0]);
  if (uniform) {
    return { ...sh, sats: planeSats[0]!, planeSats: undefined, totalSats: targetCount };
  }
  return { ...sh, planeSats, sats: planeSats[0]!, totalSats: targetCount };
}

/** Proportionally scale shell grids to an exact fleet total (McDowell working). */
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

/** Granted shells scaled to McDowell working — Walker fit + ghost reference count. */
export function resolveGrantedTopologyShellsScaled(
  fleetTarget: number = TOPOLOGY_FLEET_TARGET,
  fittedPhasing?: Map<string, number>
): StarlinkShellSpec[] {
  return scaleShellSpecsToFleetTarget(resolveGrantedTopologyShells(fittedPhasing), fleetTarget);
}

/** Granted shells at McDowell scale — pending FCC shells omitted until activated. */
export function resolveWalkerGhostShells(
  fleetTarget: number = TOPOLOGY_FLEET_TARGET,
  fittedPhasing?: Map<string, number>
): StarlinkShellSpec[] {
  return resolveGrantedTopologyShellsScaled(fleetTarget, fittedPhasing);
}

export function distributeSatsAcrossPlanes(planes: number, total: number): number[] {
  const base = Math.floor(total / planes);
  const rem = total % planes;
  return Array.from({ length: planes }, (_, p) => base + (p < rem ? 1 : 0));
}

export function walkerShellIndexForInclination(inc: number, shells: readonly StarlinkShellSpec[] = STARLINK_SHELL_SPECS): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < shells.length; i++) {
    const diff = Math.abs(shells[i]!.inc - inc);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
