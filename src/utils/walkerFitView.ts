import {
  ORBITAL_SHELL_FILTER_SPECS,
  TRANSIT_SHELL_INDEX,
} from '../data/orbitalShellClassification';
import type { WalkerFitPayload } from '../walkerFit/types';

export interface WalkerShellCountRow {
  shell: number;
  count: number | null;
}

/** Per-shell fitted counts from Walker fit — single source for shell list + lattice panel. */
export function shellCountsFromWalkerFit(
  fit: WalkerFitPayload | null,
  liveAvailable: boolean
): WalkerShellCountRow[] {
  const assignedByShell = new Map(
    fit?.shells.map((sh) => [sh.shellIndex, sh.occupancy.assigned]) ?? []
  );

  return ORBITAL_SHELL_FILTER_SPECS.map((spec) => {
    if (spec.index === TRANSIT_SHELL_INDEX) {
      return {
        shell: spec.index,
        count: liveAvailable ? (fit?.transitCount ?? 0) : null,
      };
    }
    return {
      shell: spec.index,
      count: fit ? (assignedByShell.get(spec.index) ?? 0) : null,
    };
  });
}

export function totalSlotConflicts(fit: WalkerFitPayload | null): number {
  if (!fit) return 0;
  return fit.shells.reduce((sum, sh) => sum + sh.occupancy.collisions, 0);
}

export function totalEmptySlots(fit: WalkerFitPayload | null): number {
  if (!fit) return 0;
  return fit.shells.reduce((sum, sh) => sum + sh.occupancy.empty, 0);
}
