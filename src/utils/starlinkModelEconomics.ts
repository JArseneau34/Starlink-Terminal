import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';
import type { StarlinkIntelPayload } from '../types/orbital';

/**
 * Per-satellite downlink capacity (Gbps) by hardware generation — mirrors the authoritative
 * assumption matrix in Space-Industry-Data-Pipeline that derives the constellation Tbps figure.
 */
export const GBPS_PER_SAT = {
  v1: 12,
  v15: 24,
  v2Mini: 96,
  v2MiniOpt: 96,
  v2MiniD2c: 0,
} as const;

/** V1.5 broadband capacity is the baseline (1×) the other generations are compared against. */
const BASELINE_GBPS = GBPS_PER_SAT.v15;

export interface ModelEconomicsEntry {
  key: 'v15' | 'v2mini' | 'dtc';
  label: string;
  capability: string;
  /** Per-sat broadband capacity in Gbps. DTC carries no broadband and is null. */
  gbpsPerSat: number | null;
  /** Capacity per sat relative to V1.5. null for DTC (different capability class). */
  multipleVsV15: number | null;
  count: number;
  /** Aggregate broadband capacity contributed by the in-orbit fleet of this model, in Tbps. */
  fleetTbps: number;
  /** Share of total constellation broadband capacity (0–1). */
  capacityShare: number;
  accent: string;
}

export interface ModelEconomicsSnapshot {
  entries: ModelEconomicsEntry[];
  totalBroadbandTbps: number;
  snapshotDate: string;
  /** Headline: how much more broadband a V2 Mini delivers per satellite vs V1.5. */
  v2VsV15Multiple: number;
}

export function buildModelEconomics(intel: StarlinkIntelPayload | null): ModelEconomicsSnapshot {
  const models = intel?.authoritative.models ?? STARLINK_FLEET_SNAPSHOT.models;
  const snapshotDate = intel?.authoritative.snapshotDate ?? STARLINK_FLEET_SNAPSHOT.snapshotDate;

  const v2MiniCount = models.v2Mini + models.v2MiniOpt;
  const dtcCount = models.v2MiniD2c;

  const totalBroadbandGbps =
    models.v1 * GBPS_PER_SAT.v1 +
    models.v15 * GBPS_PER_SAT.v15 +
    models.v2Mini * GBPS_PER_SAT.v2Mini +
    models.v2MiniOpt * GBPS_PER_SAT.v2MiniOpt +
    models.v2MiniD2c * GBPS_PER_SAT.v2MiniD2c;
  const totalBroadbandTbps = totalBroadbandGbps / 1000;
  const safeTotalGbps = totalBroadbandGbps || 1;

  const entries: ModelEconomicsEntry[] = [
    {
      key: 'v15',
      label: 'V1.5',
      capability: 'Laser-link broadband',
      gbpsPerSat: GBPS_PER_SAT.v15,
      multipleVsV15: 1,
      count: models.v15,
      fleetTbps: (models.v15 * GBPS_PER_SAT.v15) / 1000,
      capacityShare: (models.v15 * GBPS_PER_SAT.v15) / safeTotalGbps,
      accent: '#3de8ff',
    },
    {
      key: 'v2mini',
      label: 'V2 Mini',
      capability: 'Gen-2 broadband',
      gbpsPerSat: GBPS_PER_SAT.v2Mini,
      multipleVsV15: GBPS_PER_SAT.v2Mini / BASELINE_GBPS,
      count: v2MiniCount,
      fleetTbps: (v2MiniCount * GBPS_PER_SAT.v2Mini) / 1000,
      capacityShare: (v2MiniCount * GBPS_PER_SAT.v2Mini) / safeTotalGbps,
      accent: '#a78bfa',
    },
    {
      key: 'dtc',
      label: 'V2 Mini DTC',
      capability: 'Direct-to-cell',
      gbpsPerSat: null,
      multipleVsV15: null,
      count: dtcCount,
      fleetTbps: 0,
      capacityShare: 0,
      accent: '#2ee86a',
    },
  ];

  return {
    entries,
    totalBroadbandTbps,
    snapshotDate,
    v2VsV15Multiple: GBPS_PER_SAT.v2Mini / BASELINE_GBPS,
  };
}
