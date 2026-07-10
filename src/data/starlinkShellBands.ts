/**
 * Live catalog shell bands — orbital shell classification from shellReference.
 * Walker topology grids live in starlinkShells.ts.
 */

import type { StarlinkLifecycle } from './starlinkOrbitOmm';
import {
  classifyOrbitalShell,
  ORBITAL_SHELL_FILTER_COUNT,
  ORBITAL_SHELL_FILTER_SPECS,
} from './orbitalShellClassification';
import { SHELL_REFERENCE } from './shellReference';

export type { StarlinkLifecycle } from './starlinkOrbitOmm';
export {
  classifyOrbitalShell,
  isTransitShellIndex,
  orbitalShellName,
  ORBITAL_SHELL_FILTER_COUNT,
  ORBITAL_SHELL_FILTER_INDICES,
  ORBITAL_SHELL_FILTER_SPECS,
  allOrbitalShellFilterIndices,
  TRANSIT_SHELL_INDEX,
  type OrbitalShellAssignment,
  type OrbitalShellFilterSpec,
} from './orbitalShellClassification';
export { inferModelHint, type StarlinkModelHint } from './starlinkVisualShells';

export interface StarlinkShellBand {
  index: number;
  name: string;
  inc: number;
  color: number;
  maxDeltaDeg: number;
  status: 'granted' | 'pending' | 'transit';
}

export const CANONICAL_SHELL_BANDS: StarlinkShellBand[] = ORBITAL_SHELL_FILTER_SPECS.map((spec) => {
  const ref = SHELL_REFERENCE[spec.index];
  return {
    index: spec.index,
    name: spec.name,
    inc: ref?.incDeg ?? 0,
    color: spec.color,
    maxDeltaDeg: 0.5,
    status: spec.status,
  };
});

const SHELL_BAND_BY_INDEX = new Map(
  CANONICAL_SHELL_BANDS.map((band) => [band.index, band] as const)
);

/** Resolve a live-catalog shell band by structural index (not array offset). */
export function shellBandByIndex(shellIndex: number): StarlinkShellBand | undefined {
  return SHELL_BAND_BY_INDEX.get(shellIndex);
}

export const SHELL_BAND_COUNT = ORBITAL_SHELL_FILTER_COUNT;

export function deriveShellCounts(
  shellIndices: readonly number[],
  _bandCount: number = SHELL_BAND_COUNT
): { shell: number; count: number }[] {
  const counts = ORBITAL_SHELL_FILTER_SPECS.map((spec) => ({ shell: spec.index, count: 0 }));
  for (const shell of shellIndices) {
    const idx = ORBITAL_SHELL_FILTER_SPECS.findIndex((s) => s.index === shell);
    if (idx >= 0) counts[idx]!.count++;
  }
  return counts;
}

export interface StarlinkCatalogShell {
  index: number;
  name: string;
  inclination: number;
  count: number;
  color: number;
  status?: 'granted' | 'pending' | 'transit';
}

export function buildCatalogShells(shellIndices: readonly number[]): StarlinkCatalogShell[] {
  const counts = deriveShellCounts(shellIndices);
  return ORBITAL_SHELL_FILTER_SPECS.map((spec, i) => ({
    index: spec.index,
    name: spec.name,
    inclination: 0,
    count: counts[i]?.count ?? 0,
    color: spec.color,
    status: spec.status,
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
  const buckets = ORBITAL_SHELL_FILTER_SPECS.map((spec) => {
    const ref = SHELL_REFERENCE[spec.index];
    return {
      name: spec.name,
      inclination: ref?.incDeg ?? 0,
      count: 0,
      operational: 0,
      raising: 0,
      deorbiting: 0,
      altSum: 0,
    };
  });

  for (const row of inputs) {
    const idx = ORBITAL_SHELL_FILTER_SPECS.findIndex((s) => s.index === row.shell);
    const target = idx >= 0 ? buckets[idx] : undefined;
    if (!target) continue;
    target.count++;
    target.altSum += row.meanAltitudeKm;
    if (row.lifecycle === 'operational') target.operational++;
    else if (row.lifecycle === 'raising') target.raising++;
    else if (row.lifecycle === 'deorbiting') target.deorbiting++;
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

/** Structural shell index from mean inclination + altitude. */
export function shellIndexForInclination(inc: number, altKm: number): number {
  const assignment = classifyOrbitalShell(
    { inclination: inc, meanAltKm: altKm, perigeeKm: altKm, apogeeKm: altKm, eccentricity: 0 },
    'operational'
  );
  return assignment.structuralIndex;
}
