import type { StarlinkShellSpec } from '../data/starlinkShells';

import { classifyOrbitalShell } from '../data/orbitalShellClassification';

import {
  ommToInvariantRaanPhase,
  type OmmAngleInput,
  radiansToDeg,

  torusDistance,

  wrapRad,

} from './frame';

import { buildGhostLattice, planeSatCounts, shellHex, shellSatCount, walkerPhase0 } from './lattice';

import type {

  WalkerFitAssignment,

  WalkerFitInputSat,

  WalkerFitShell,

  WalkerFitShellOccupancy,

  WalkerLatticePoint,

} from './types';

function satRaanPhase(sat: WalkerFitInputSat, when: Date): { raan: number; phase: number } {
  const omm: OmmAngleInput = {
    NORAD_CAT_ID: sat.noradId,
    OBJECT_NAME: sat.name,
    EPOCH: sat.epoch,
    MEAN_MOTION: sat.meanMotion,
    INCLINATION: sat.inclination,
    ECCENTRICITY: sat.eccentricity,
    RA_OF_ASC_NODE: sat.raanDeg,
    ARG_OF_PERICENTER: sat.argPerDeg,
    MEAN_ANOMALY: sat.meanAnomalyDeg,
  };
  return ommToInvariantRaanPhase(sat.raanDeg, sat.argPerDeg, sat.meanAnomalyDeg, omm, when);
}

function residualThresholds(sh: StarlinkShellSpec): { warn: number; alert: number } {
  if (sh.inc >= 97) return { warn: 8, alert: 15 };

  if (sh.totalSats < 500) return { warn: 5, alert: 10 };

  return { warn: 2, alert: 5 };

}



function applyLatticeOffsets(

  lattice: WalkerLatticePoint[],

  raanOffset: number,

  phaseOffset: number

): WalkerLatticePoint[] {

  return lattice.map((g) => ({

    ...g,

    raan: wrapRad(g.raan + raanOffset),

    phase: wrapRad(g.phase + phaseOffset),

  }));

}



function circularMeanOffset(obs: number[], lattice: number[]): number {

  if (obs.length === 0) return 0;

  let sinSum = 0;

  let cosSum = 0;

  for (let i = 0; i < obs.length; i++) {

    const delta = wrapRad(obs[i]! - lattice[i]!);

    sinSum += Math.sin(delta);

    cosSum += Math.cos(delta);

  }

  return Math.atan2(sinSum / obs.length, cosSum / obs.length);

}



function meanAssignmentResidual(
  sats: WalkerFitInputSat[],
  lattice: WalkerLatticePoint[],
  when: Date
): number {
  if (sats.length === 0) return Infinity;
  let sum = 0;
  for (const sat of sats) {
    const { raan, phase } = satRaanPhase(sat, when);

    let best = Infinity;

    for (const g of lattice) {

      const d = torusDistance(raan, phase, g.raan, g.phase);

      if (d < best) best = d;

    }

    sum += best;

  }

  return sum / sats.length;

}



function fitWalkerPhasing(sh: StarlinkShellSpec, sats: WalkerFitInputSat[], when: Date): number {
  const P = sh.planes;
  if (P <= 1 || sats.length === 0) return sh.walkerF ?? 1;
  let bestF = sh.walkerF ?? 1;
  let bestScore = Infinity;
  for (let F = 0; F < P; F++) {
    const lattice = buildGhostLattice({ ...sh, walkerF: F });
    const score = meanAssignmentResidual(sats, lattice, when);

    if (score < bestScore) {

      bestScore = score;

      bestF = F;

    }

  }

  return bestF;

}



function fitAnchorOffsets(
  sats: WalkerFitInputSat[],
  lattice: WalkerLatticePoint[],
  when: Date
): { raanOffset: number; phaseOffset: number } {
  const obsRaan: number[] = [];
  const obsPhase: number[] = [];
  const latRaan: number[] = [];
  const latPhase: number[] = [];

  for (const sat of sats) {
    const { raan, phase } = satRaanPhase(sat, when);

    let bestIdx = 0;

    let bestDist = Infinity;

    for (let i = 0; i < lattice.length; i++) {

      const g = lattice[i]!;

      const d = torusDistance(raan, phase, g.raan, g.phase);

      if (d < bestDist) {

        bestDist = d;

        bestIdx = i;

      }

    }

    const g = lattice[bestIdx]!;

    obsRaan.push(raan);

    obsPhase.push(phase);

    latRaan.push(g.raan);

    latPhase.push(g.phase);

  }



  return {

    raanOffset: circularMeanOffset(obsRaan, latRaan),

    phaseOffset: circularMeanOffset(obsPhase, latPhase),

  };

}



function occupancyStats(

  sh: StarlinkShellSpec,

  latticeSlots: number,

  assignments: WalkerFitAssignment[]

): WalkerFitShellOccupancy {

  const slotMap = new Map<string, number>();

  for (const a of assignments) {

    const key = `${a.plane}:${a.slot}`;

    slotMap.set(key, (slotMap.get(key) ?? 0) + 1);

  }

  const collisions = [...slotMap.values()].filter((n) => n > 1).length;

  const assignedSlots = slotMap.size;

  const residuals = assignments.map((a) => a.residualDeg).sort((a, b) => a - b);

  const meanResidualDeg =

    residuals.length > 0 ? residuals.reduce((s, v) => s + v, 0) / residuals.length : 0;

  const p95ResidualDeg =

    residuals.length > 0 ? residuals[Math.floor(residuals.length * 0.95)] ?? 0 : 0;

  const operationalAssigned = assignments.filter((a) => a.lifecycle === 'operational').length;



  return {

    latticeSlots,

    assigned: assignments.length,

    empty: Math.max(0, latticeSlots - assignedSlots),

    collisions,

    meanResidualDeg: Math.round(meanResidualDeg * 100) / 100,

    p95ResidualDeg: Math.round(p95ResidualDeg * 100) / 100,

    unfilledSlots: Math.max(0, sh.totalSats - operationalAssigned),

    unassignedSats: 0,

  };

}



export function fitShell(
  shellIndex: number,
  sh: StarlinkShellSpec,
  sats: WalkerFitInputSat[],
  referenceTime: string
): WalkerFitShell {
  const refWhen = new Date(referenceTime);
  const fittedF = fitWalkerPhasing(sh, sats, refWhen);
  const shWithF = { ...sh, walkerF: fittedF };
  const baseLattice = buildGhostLattice(shWithF);
  const { raanOffset, phaseOffset } = fitAnchorOffsets(sats, baseLattice, refWhen);
  const ghostLattice = applyLatticeOffsets(baseLattice, raanOffset, phaseOffset);

  const assignments: WalkerFitAssignment[] = [];

  for (const sat of sats) {
    const { raan, phase } = satRaanPhase(sat, refWhen);



    let bestIdx = 0;

    let bestDist = Infinity;

    for (let i = 0; i < ghostLattice.length; i++) {

      const g = ghostLattice[i]!;

      const d = torusDistance(raan, phase, g.raan, g.phase);

      if (d < bestDist) {

        bestDist = d;

        bestIdx = i;

      }

    }



    const g = ghostLattice[bestIdx]!;

    assignments.push({

      noradId: sat.noradId,

      name: sat.name,

      plane: g.plane,

      slot: g.slot,

      raanObs: raan,

      phaseObs: phase,

      raanLattice: g.raan,

      phaseLattice: g.phase,

      residualDeg: Math.round(radiansToDeg(bestDist) * 100) / 100,

      lifecycle: sat.lifecycle,

    });

  }



  const thresholds = residualThresholds(sh);



  return {

    shellIndex,

    shellKey: sh.key,

    name: sh.name,

    inc: sh.inc,

    altKm: sh.altKm,

    planes: sh.planes,

    planeSats: planeSatCounts(shWithF),

    totalSats: sh.totalSats,

    walkerF: fittedF,

    phasingSource: sh.phasingSource === 'fitted' || fittedF !== (sh.walkerF ?? 1) ? 'fitted' : 'fcc',

    raanOffsetRad: raanOffset,

    phaseOffsetRad: phaseOffset,

    color: shellHex(sh.color),

    status: sh.status === 'pending' ? 'pending' : 'granted',

    ghostLattice,

    assignments,

    occupancy: occupancyStats(shWithF, ghostLattice.length, assignments),

    residualWarnDeg: thresholds.warn,

    residualAlertDeg: thresholds.alert,

  };

}



export function toWalkerFitInputSat(

  sat: Omit<WalkerFitInputSat, 'structuralIndex' | 'isTransit'> & {

    structuralIndex?: number;

    isTransit?: boolean;

  }

): WalkerFitInputSat {

  if (sat.structuralIndex != null && sat.isTransit != null) {

    return sat as WalkerFitInputSat;

  }

  const assignment = classifyOrbitalShell(

    {

      inclination: sat.inclination,

      meanAltKm: sat.meanAltKm,

      perigeeKm: sat.meanAltKm,

      apogeeKm: sat.meanAltKm,

      eccentricity: sat.eccentricity,

    },

    sat.lifecycle as 'operational' | 'raising' | 'deorbiting' | 'other',

    {

      raanDeg: sat.raanDeg,

      argPerDeg: sat.argPerDeg,

      meanAnomalyDeg: sat.meanAnomalyDeg,

    }

  );

  return {

    ...sat,

    structuralIndex: assignment.structuralIndex,

    isTransit: assignment.isTransit,

  };

}



export function groupSatsByShell(

  sats: WalkerFitInputSat[],

  shells: StarlinkShellSpec[]

): WalkerFitInputSat[][] {

  const groups = shells.map(() => [] as WalkerFitInputSat[]);

  const shellByIndex = new Map(shells.map((sh) => [sh.structuralIndex, sh]));

  const shellOrder = shells.map((sh) => sh.structuralIndex);



  for (const raw of sats) {

    const sat = toWalkerFitInputSat(raw);

    if (sat.isTransit) continue;

    const idx = shellOrder.indexOf(sat.structuralIndex);

    if (idx >= 0) {

      groups[idx]!.push(sat);

      continue;

    }

    const sh = shellByIndex.get(sat.structuralIndex);

    if (sh) {

      const orderIdx = shells.indexOf(sh);

      if (orderIdx >= 0) groups[orderIdx]!.push(sat);

    }

  }

  return groups;

}



/** @deprecated Use groupSatsByShell */

export function groupSatsByTopologyShell(

  sats: WalkerFitInputSat[],

  shells: StarlinkShellSpec[]

): WalkerFitInputSat[][] {

  return groupSatsByShell(sats, shells);

}



export { shellSatCount, walkerPhase0 };


