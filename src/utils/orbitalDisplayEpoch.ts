import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';
import { TOPOLOGY_REFERENCE_EPOCH } from './starlinkPropagation';
import { sanitizeFleetSnapshotDate } from './fleetSnapshotDate';
import type { StarlinkCatalogPayload } from '../types/orbital';
import type { WalkerFitPayload } from '../walkerFit/types';

const ENRICH_STALE_MS = 7 * 24 * 3_600_000;

export interface OrbitalDisplayEpochState {
  displayEpochIso: string;
  displayLabel: string;
  enrichStale: boolean;
  tleOffline: boolean;
  liveAvailable: boolean;
  mcdowellSnapshotDate: string;
}

export function formatOrbitalEpochLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatOrbitalEpochShort(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
}

export function resolveOrbitalDisplayEpoch(opts: {
  liveCatalog: StarlinkCatalogPayload | null;
  walkerFit: WalkerFitPayload | null;
  fleetSnapshotDate?: string | null;
  tleOffline: boolean;
  liveAvailable: boolean;
}): OrbitalDisplayEpochState {
  const mcdowellSnapshotDate = sanitizeFleetSnapshotDate(
    opts.walkerFit?.mcdowellSnapshotDate ??
      opts.fleetSnapshotDate ??
      STARLINK_FLEET_SNAPSHOT.snapshotDate
  );

  const fitEpoch =
    opts.walkerFit?.referenceTime ?? `${mcdowellSnapshotDate}T12:00:00.000Z`;
  const tleEpoch = opts.liveCatalog?.referenceTime ?? null;

  const displayEpochIso =
    opts.liveAvailable && tleEpoch
      ? tleEpoch
      : fitEpoch || TOPOLOGY_REFERENCE_EPOCH;

  const fitMs = Date.parse(fitEpoch);
  const tleMs = tleEpoch ? Date.parse(tleEpoch) : NaN;
  const enrichStale =
    opts.liveAvailable &&
    Number.isFinite(fitMs) &&
    Number.isFinite(tleMs) &&
    Math.abs(fitMs - tleMs) > ENRICH_STALE_MS;

  return {
    displayEpochIso,
    displayLabel: formatOrbitalEpochShort(displayEpochIso),
    enrichStale,
    tleOffline: opts.tleOffline,
    liveAvailable: opts.liveAvailable,
    mcdowellSnapshotDate,
  };
}
