/**
 * Live catalog shell bands — derived counts, visual classification specs.
 * Walker topology grids live in starlinkShells.ts only.
 */

import type { StarlinkLifecycle } from './starlinkOrbitOmm';
import { VISUAL_SHELL_SPECS, VISUAL_SHELL_COUNT } from './starlinkVisualShells';

export type { StarlinkLifecycle } from './starlinkOrbitOmm';
export {
  classifyVisualShell,
  inferModelHint,
  type StarlinkModelHint,
  type VisualShellAssignment,
  type VisualShellSpec,
  VISUAL_SHELL_COUNT,
  VISUAL_SHELL_SPECS,
} from './starlinkVisualShells';
export { walkerShellIndexForInclination as shellIndexForInclination } from './starlinkShells';

export interface StarlinkShellBand {
  index: number;
  name: string;
  inc: number;
  color: number;
  maxDeltaDeg: number;
}

export const CANONICAL_SHELL_BANDS: StarlinkShellBand[] = VISUAL_SHELL_SPECS.map((spec) => ({
  index: spec.index,
  name: spec.name,
  inc: spec.nominalInc,
  color: spec.color,
  maxDeltaDeg: 0.5,
}));

export const SHELL_BAND_COUNT = VISUAL_SHELL_COUNT;

/** @deprecated Use VISUAL_SHELL_SPECS */
export const STARLINK_SHELL_BANDS = CANONICAL_SHELL_BANDS.map(({ name, inc, color }) => ({
  name,
  inc,
  color,
}));

export function deriveShellCounts(
  shellIndices: readonly number[],
  bandCount: number = SHELL_BAND_COUNT
): { shell: number; count: number }[] {
  const counts = Array.from({ length: bandCount }, (_, shell) => ({ shell, count: 0 }));
  for (const shell of shellIndices) {
    if (shell >= 0 && shell < bandCount) {
      counts[shell]!.count++;
    }
  }
  return counts;
}

export interface StarlinkCatalogShell {
  index: number;
  name: string;
  inclination: number;
  count: number;
  color: number;
}

export function buildCatalogShells(shellIndices: readonly number[]): StarlinkCatalogShell[] {
  const counts = deriveShellCounts(shellIndices);
  return VISUAL_SHELL_SPECS.map((spec, i) => ({
    index: spec.index,
    name: spec.name,
    inclination: spec.nominalInc,
    count: counts[i]?.count ?? 0,
    color: spec.color,
  }));
}

export type ShellLifecycle = StarlinkLifecycle;

export interface ShellSummaryInput {
  shell: number;
  meanAltitudeKm: number;
  lifecycle: ShellLifecycle;
}

export interface StarlinkShellSummary {
  name: string;
  inclination: number;
  count: number;
  operational: number;
  raising: number;
  deorbiting: number;
  meanAltitudeKm: number;
}

export function buildShellSummary(inputs: readonly ShellSummaryInput[]): StarlinkShellSummary[] {
  const buckets = VISUAL_SHELL_SPECS.map((spec) => ({
    name: spec.name,
    inclination: spec.nominalInc,
    count: 0,
    operational: 0,
    raising: 0,
    deorbiting: 0,
    altSum: 0,
  }));

  for (const row of inputs) {
    const bucket = buckets[row.shell];
    if (!bucket) continue;
    bucket.count++;
    bucket.altSum += row.meanAltitudeKm;
    if (row.lifecycle === 'operational') bucket.operational++;
    else if (row.lifecycle === 'raising') bucket.raising++;
    else if (row.lifecycle === 'deorbiting') bucket.deorbiting++;
  }

  return buckets.map((b) => ({
    name: b.name,
    inclination: b.inclination,
    count: b.count,
    operational: b.operational,
    raising: b.raising,
    deorbiting: b.deorbiting,
    meanAltitudeKm: b.count > 0 ? Math.round(b.altSum / b.count) : 0,
  }));
}
