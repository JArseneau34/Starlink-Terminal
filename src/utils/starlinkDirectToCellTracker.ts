import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';
import { STARLINK_DEPLOYMENT_SPECS } from '../data/starlinkDeployments';
import type { StarlinkIntelPayload } from '../types/orbital';

export interface DirectToCellTrackerSnapshot {
  snapshotDate: string;
  dtcSatellites: number;
  totalWorking: number;
  gen2FamilySatellites: number;
  fleetShare: number;
  gen2Share: number;
  broadbandTbpsDisplaced: number;
  curatedDtcLaunches: number;
  curatedDtcPayloadSats: number;
  mostRecentCuratedSignal: string | null;
}

export function buildDirectToCellTracker(
  intel: StarlinkIntelPayload | null
): DirectToCellTrackerSnapshot {
  const authoritative = intel?.authoritative ?? {
    snapshotDate: STARLINK_FLEET_SNAPSHOT.snapshotDate,
    totalWorking: STARLINK_FLEET_SNAPSHOT.totalWorking,
    models: STARLINK_FLEET_SNAPSHOT.models,
  };
  const models = authoritative.models;
  const dtcSatellites = models.v2MiniD2c;
  const gen2FamilySatellites = models.v2Mini + models.v2MiniOpt + models.v2MiniD2c;
  const curatedDtcSignals = STARLINK_DEPLOYMENT_SPECS.filter((spec) =>
    spec.note?.toLowerCase().includes('direct-to-cell')
  );

  return {
    snapshotDate: authoritative.snapshotDate,
    dtcSatellites,
    totalWorking: authoritative.totalWorking,
    gen2FamilySatellites,
    fleetShare: dtcSatellites / (authoritative.totalWorking || 1),
    gen2Share: dtcSatellites / (gen2FamilySatellites || 1),
    broadbandTbpsDisplaced: 0,
    curatedDtcLaunches: curatedDtcSignals.length,
    curatedDtcPayloadSats: curatedDtcSignals.reduce((sum, spec) => sum + spec.count, 0),
    mostRecentCuratedSignal: curatedDtcSignals[0]?.launchName ?? null,
  };
}
