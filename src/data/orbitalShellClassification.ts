/**

 * Orbit-based shell classification for live TLEs — mean inclination (0.1°) and

 * shell-family altitude matching. Hardware model hints are orthogonal (see starlinkVisualShells).

 */



import type { OrbitSnapshot, StarlinkLifecycle } from './starlinkOrbitOmm';

import { shellReferenceToSpec } from './starlinkShells';

import {

  formatShellLabel,

  GRANTED_SHELL_REFERENCE,

  SHELL_REFERENCE_COUNT,

  shellReferenceByIndex,

  TRANSIT_SHELL_INDEX,

  type ShellReferenceRow,

} from './shellReference';

import { buildGhostLattice } from '../walkerFit/lattice';

import { ommToInvariantRaanPhase, torusDistance } from '../walkerFit/frame';



export {
  TRANSIT_SHELL_INDEX,
  ORBITAL_SHELL_FILTER_COUNT,
  ORBITAL_SHELL_FILTER_INDICES,
  allOrbitalShellFilterIndices,
} from './shellReference';



/** Optional mean elements for SSO duplicate resolution (gen1:3 vs gen1:5). */

export interface OrbitalShellElements {

  raanDeg: number;

  argPerDeg: number;

  meanAnomalyDeg: number;

}



export interface OrbitalShellFilterSpec {

  index: number;

  name: string;

  color: number;

  status: 'granted' | 'pending' | 'transit';

  constellationGen?: 'gen1' | 'gen2';

}



export const ORBITAL_SHELL_FILTER_SPECS: OrbitalShellFilterSpec[] = [

  ...GRANTED_SHELL_REFERENCE.map((row) => ({

    index: row.structuralIndex,

    name: formatShellLabel(row),

    color: row.color,

    status: row.status,

    constellationGen: row.constellationGen,

  })),

  {

    index: TRANSIT_SHELL_INDEX,

    name: 'Transit',

    color: 0x94a3b8,

    status: 'transit' as const,

  },

];



export interface OrbitalShellAssignment {

  structuralIndex: number;

  shellKey: string | null;

  shellName: string;

  isTransit: boolean;

  constellationGen: 'gen1' | 'gen2' | null;

  status: 'granted' | 'pending' | 'transit';

}



function roundInc(inc: number): number {

  return Math.round(inc * 10) / 10;

}



function incTolerance(incDeg: number): number {

  // 53° family spans 53.0° and 53.2° shells — use a shared band.

  if (incDeg === 53.0 || incDeg === 53.2) return 0.35;

  if (incDeg >= 97) return 0.5;

  return 0.5;

}



function altToleranceForShell(
  row: ShellReferenceRow,
  lifecycle: StarlinkLifecycle
): number {
  // Gen2 operational sats often sit below licensed FCC altitude (drag, insertion).
  if (row.incDeg === 53.0 || row.incDeg === 53.2) {
    return lifecycle === 'operational' ? 35 : 15;
  }
  if (row.incDeg === 43.0) return lifecycle === 'operational' ? 50 : 20;
  if (row.incDeg === 33.0) return lifecycle === 'operational' ? 45 : 15;
  if (row.incDeg >= 97) return 8;
  if (row.incDeg === 70.0) return lifecycle === 'operational' ? 15 : 8;
  return 8;
}



function isRaisingToShell(

  orbit: Pick<OrbitSnapshot, 'perigeeKm' | 'eccentricity'>,

  lifecycle: StarlinkLifecycle

): boolean {

  if (lifecycle !== 'raising') return false;

  if (orbit.perigeeKm < 350) return true;

  if (orbit.eccentricity > 0.0015 && orbit.perigeeKm < 450) return true;

  return false;

}



function minLatticeDistance(

  raan: number,

  phase: number,

  row: ShellReferenceRow

): number {

  const lattice = buildGhostLattice(shellReferenceToSpec(row));

  let best = Infinity;

  for (const g of lattice) {

    const d = torusDistance(raan, phase, g.raan, g.phase);

    if (d < best) best = d;

  }

  return best;

}



function pickAmongDuplicateIncAlt(candidates: ShellReferenceRow[]): ShellReferenceRow {

  const granted = candidates.filter((c) => c.status === 'granted');

  const pool = granted.length > 0 ? granted : candidates;

  return pool.sort((a, b) => b.totalSats - a.totalSats || a.shellId - b.shellId)[0]!;

}



function pickAmongSsoDuplicates(

  candidates: ShellReferenceRow[],

  elements?: OrbitalShellElements

): ShellReferenceRow {

  if (!elements || candidates.length < 2) {

    return pickAmongDuplicateIncAlt(candidates);

  }

  const { raan, phase } = ommToInvariantRaanPhase(

    elements.raanDeg,

    elements.argPerDeg,

    elements.meanAnomalyDeg

  );

  let best = candidates[0]!;

  let bestDist = Infinity;

  for (const row of candidates) {

    const d = minLatticeDistance(raan, phase, row);

    if (d < bestDist) {

      bestDist = d;

      best = row;

    }

  }

  return best;

}



function resolveDuplicateGroup(

  group: ShellReferenceRow[],

  elements?: OrbitalShellElements

): ShellReferenceRow {

  const ssoGroup = group.every((row) => row.incDeg >= 97 && row.altKm === group[0]!.altKm);

  if (ssoGroup) return pickAmongSsoDuplicates(group, elements);

  return pickAmongDuplicateIncAlt(group);

}



function matchOrbitalShell(
  incRounded: number,
  meanAltKm: number,
  lifecycle: StarlinkLifecycle,
  elements?: OrbitalShellElements
): ShellReferenceRow | null {

  const incMatches = GRANTED_SHELL_REFERENCE.filter(

    (row) => Math.abs(incRounded - row.incDeg) <= incTolerance(row.incDeg)

  );

  if (incMatches.length === 0) return null;



  const ranked = incMatches

    .map((row) => ({

      row,

      altDelta: Math.abs(meanAltKm - row.altKm),

    }))

    .sort(

      (a, b) =>

        a.altDelta - b.altDelta ||

        (a.row.status === 'granted' ? 0 : 1) - (b.row.status === 'granted' ? 0 : 1) ||

        a.row.structuralIndex - b.row.structuralIndex

    );



  const best = ranked[0]!;

  if (best.altDelta > altToleranceForShell(best.row, lifecycle)) return null;



  const duplicateKey = `${best.row.incDeg}@${best.row.altKm}`;

  const duplicateGroup = ranked

    .filter((entry) => `${entry.row.incDeg}@${entry.row.altKm}` === duplicateKey)

    .map((entry) => entry.row);



  if (duplicateGroup.length > 1) {

    return resolveDuplicateGroup(duplicateGroup, elements);

  }



  return best.row;

}



function transitAssignment(): OrbitalShellAssignment {

  return {

    structuralIndex: TRANSIT_SHELL_INDEX,

    shellKey: null,

    shellName: 'Transit',

    isTransit: true,

    constellationGen: null,

    status: 'transit',

  };

}



/**

 * Classify a live satellite into an orbital shell by mean elements only.

 * Transit objects are never force-fit to the nearest lattice shell unless they

 * match a shell-family band (raising sats keep shell identity once near target alt).

 */

export function classifyOrbitalShell(

  orbit: OrbitSnapshot,

  lifecycle: StarlinkLifecycle,

  elements?: OrbitalShellElements

): OrbitalShellAssignment {

  if (orbit.perigeeKm < 220) return transitAssignment();

  if (lifecycle === 'deorbiting') return transitAssignment();



  const incRounded = roundInc(orbit.inclination);

  const matched = matchOrbitalShell(incRounded, orbit.meanAltKm, lifecycle, elements);



  if (!matched) return transitAssignment();

  if (isRaisingToShell(orbit, lifecycle)) return transitAssignment();



  return {

    structuralIndex: matched.structuralIndex,

    shellKey: matched.key,

    shellName: formatShellLabel(matched),

    isTransit: false,

    constellationGen: matched.constellationGen,

    status: matched.status,

  };

}



export function orbitalShellName(index: number): string {

  if (index === TRANSIT_SHELL_INDEX) return 'Transit';

  const row = shellReferenceByIndex(index);

  return row ? formatShellLabel(row) : '—';

}



export function isStructuralShellIndex(index: number): boolean {

  return index >= 0 && index < SHELL_REFERENCE_COUNT;

}



export function isTransitShellIndex(index: number): boolean {

  return index === TRANSIT_SHELL_INDEX;

}


