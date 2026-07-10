import {
  GEN1_GRANTED_TOTAL,
  GEN2_GRANTED_TOTAL,
  GRANTED_TOPOLOGY_TOTAL,
  resolveGrantedTopologyShellsScaled,
  TOPOLOGY_FLEET_TARGET,
} from '../data/starlinkShells';
import { fitShell, groupSatsByShell, toWalkerFitInputSat } from './fitShell';
import type { WalkerFitInputSat, WalkerFitPayload } from './types';

export function buildWalkerFitPayload(
  sats: WalkerFitInputSat[],
  referenceTime: string,
  tleFetchedAt: string,
  fleetTarget: number = TOPOLOGY_FLEET_TARGET,
  mcdowellSnapshotDate?: string
): WalkerFitPayload {
  const inputs = sats.map((s) => toWalkerFitInputSat(s));
  const transitCount = inputs.filter((s) => s.isTransit).length;
  const shells = resolveGrantedTopologyShellsScaled(fleetTarget);
  const groups = groupSatsByShell(inputs, shells);

  const fittedShells = shells.map((sh, i) => fitShell(i, sh, groups[i] ?? [], referenceTime));

  return {
    version: 1,
    referenceTime,
    tleFetchedAt,
    mcdowellSnapshotDate,
    grantedSlotTotal: GRANTED_TOPOLOGY_TOTAL,
    walkerReferenceTotal: fleetTarget,
    fleetTarget,
    gen1GrantedTotal: GEN1_GRANTED_TOTAL,
    gen2GrantedTotal: GEN2_GRANTED_TOTAL,
    transitCount,
    shells: fittedShells,
  };
}
