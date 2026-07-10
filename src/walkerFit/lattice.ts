import type { StarlinkShellSpec } from '../data/starlinkShells';

const TAU = Math.PI * 2;
import type { WalkerLatticePoint } from './types';

export function planeSatCounts(sh: StarlinkShellSpec): number[] {
  if (sh.planeSats?.length === sh.planes) return sh.planeSats;
  return Array.from({ length: sh.planes }, () => sh.sats);
}

export function shellSatCount(sh: StarlinkShellSpec): number {
  return sh.totalSats;
}

export function walkerPhase0(
  plane: number,
  slot: number,
  satsInPlane: number,
  shellTotal: number,
  walkerF: number
): number {
  return ((slot / satsInPlane + (plane * walkerF) / shellTotal) % 1) * TAU;
}

export function buildGhostLattice(sh: StarlinkShellSpec): WalkerLatticePoint[] {
  const counts = planeSatCounts(sh);
  const F = sh.walkerF ?? 1;
  const shellTotal = shellSatCount(sh);
  const points: WalkerLatticePoint[] = [];

  for (let p = 0; p < sh.planes; p++) {
    const satsInPlane = counts[p]!;
    const raan = (p / sh.planes) * TAU;
    for (let s = 0; s < satsInPlane; s++) {
      points.push({
        plane: p,
        slot: s,
        raan,
        phase: walkerPhase0(p, s, satsInPlane, shellTotal, F),
      });
    }
  }

  return points;
}

export function shellHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
