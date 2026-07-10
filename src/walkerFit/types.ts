export interface WalkerLatticePoint {

  plane: number;

  slot: number;

  raan: number;

  phase: number;

}



export interface WalkerFitAssignment {

  noradId: number;

  name: string;

  plane: number;

  slot: number;

  raanObs: number;

  phaseObs: number;

  raanLattice: number;

  phaseLattice: number;

  residualDeg: number;

  lifecycle: string;

}



export interface WalkerFitShellOccupancy {

  latticeSlots: number;

  assigned: number;

  empty: number;

  collisions: number;

  meanResidualDeg: number;

  p95ResidualDeg: number;

  /** Authorized slots minus assigned operational sats. */

  unfilledSlots: number;

  unassignedSats: number;

}



export interface WalkerFitShell {

  shellIndex: number;

  shellKey: string;

  name: string;

  inc: number;

  altKm: number;

  planes: number;

  planeSats: number[];

  totalSats: number;

  walkerF: number;

  phasingSource: 'fcc' | 'fitted';

  raanOffsetRad: number;

  phaseOffsetRad: number;

  color: string;

  status: 'granted' | 'pending';

  ghostLattice: WalkerLatticePoint[];

  assignments: WalkerFitAssignment[];

  occupancy: WalkerFitShellOccupancy;

  /** Residual thresholds for torus coloring (wider for sparse shells). */

  residualWarnDeg: number;

  residualAlertDeg: number;

}



export interface WalkerFitPayload {

  version: 1;

  referenceTime: string;

  tleFetchedAt: string;

  /** McDowell JSR snapshot date (YYYY-MM-DD) used as Walker fit reference epoch. */
  mcdowellSnapshotDate?: string;

  grantedSlotTotal: number;

  /** McDowell total_working — scaled Walker lattice node count. */
  walkerReferenceTotal: number;

  fleetTarget: number;

  gen1GrantedTotal: number;

  gen2GrantedTotal: number;

  transitCount: number;

  shells: WalkerFitShell[];

}



export interface WalkerFitInputSat {

  noradId: number;

  name: string;

  inclination: number;

  meanAltKm: number;

  raanDeg: number;

  argPerDeg: number;

  meanAnomalyDeg: number;

  eccentricity: number;

  meanMotion?: number;

  lifecycle: string;

  structuralIndex: number;

  isTransit: boolean;

  /** TLE epoch for SGP4 RAAN×phase at display reference. */
  epoch?: string;

}


