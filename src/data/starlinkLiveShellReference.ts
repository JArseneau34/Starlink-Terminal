/**
 * Live catalog verification reference.
 *
 * - **Image taxonomy** — nine mission/orbit buckets (Gen1-I … Other) from the user's
 *   reference shell image; used for live-mode display and classification targets.
 * - **McDowell working** — authoritative fleet total and hardware generation mix
 *   from STARLINK_FLEET_SNAPSHOT (sync:fleet-snapshot / Jonathan McDowell).
 *
 * NORAD totals prefer the live TLE catalog count when available; static fallbacks
 * use the synced McDowell snapshot plus a historical NORAD−McDowell transit gap.
 */

import {
  STARLINK_FLEET_SNAPSHOT,
  type StarlinkFleetModelCounts,
  type StarlinkFleetSnapshot,
} from './starlinkFleetSnapshot';

/** Historical NORAD−McDowell gap from May 2026 reference image (raising/decay TLEs). */
export const STATIC_NORAD_MCDOWELL_DELTA = 151;

export function resolveNoradReferenceTotal(noradTracked?: number): number {
  if (noradTracked != null && noradTracked > 0) return noradTracked;
  return STARLINK_FLEET_SNAPSHOT.totalWorking + STATIC_NORAD_MCDOWELL_DELTA;
}

/** Static fallback when live TLE count is unavailable — derived from synced McDowell snapshot. */
export const IMAGE_NORAD_TOTAL = resolveNoradReferenceTotal();

/** McDowell working fleet — primary live-catalog count target (static fallback). */
export const MCDOWELL_WORKING_TOTAL = STARLINK_FLEET_SNAPSHOT.totalWorking;

export const MCDOWELL_MODEL_COUNTS = STARLINK_FLEET_SNAPSHOT.models;

export function buildGenerationMixReference(models: StarlinkFleetModelCounts) {
  return {
    gen1Hardware: models.v1 + models.v15,
    gen2Hardware: models.v2Mini + models.v2MiniD2c + models.v2MiniOpt,
    v1: models.v1,
    v15: models.v15,
    v2Mini: models.v2Mini,
    v2MiniD2c: models.v2MiniD2c,
    v2MiniOpt: models.v2MiniOpt,
  } as const;
}

/**
 * Map McDowell hardware segments → image mission buckets (generation families).
 * Orbit-specific buckets (Polar, SSO) draw from both v1.5 and v2 populations.
 */
export const GENERATION_MIX_REFERENCE = buildGenerationMixReference(MCDOWELL_MODEL_COUNTS);

export type LiveShellCategoryTarget = {
  count: number;
  tolerancePct: number;
  maxCount?: number;
  source: string;
};

export function buildLiveShellCategoryTargets(
  fleet: StarlinkFleetSnapshot = STARLINK_FLEET_SNAPSHOT,
  noradTotal?: number
): Record<string, LiveShellCategoryTarget> {
  const models = fleet.models;
  const mix = buildGenerationMixReference(models);
  const noradRef = resolveNoradReferenceTotal(noradTotal);
  const noradTransitDelta = Math.max(0, noradRef - fleet.totalWorking);
  const gen1TransitTarget = Math.round(noradTransitDelta * 0.35);
  const gen2TransitTarget = Math.round(noradTransitDelta * 0.65);
  const gen1IiTarget = Math.round(models.v15 * 0.82);

  return {
    'Gen1-I': { count: models.v1, tolerancePct: 20, source: 'McDowell v1.0' },
    'Gen1-II': { count: gen1IiTarget, tolerancePct: 18, source: 'McDowell v1.5 @ 53°' },
    'Gen1-Transit': {
      count: gen1TransitTarget,
      tolerancePct: 50,
      source: 'NORAD−McDowell gen1 transit',
    },
    Gen2: { count: mix.gen2Hardware, tolerancePct: 12, source: 'McDowell v2 mini family' },
    'Gen2-Transit': {
      count: gen2TransitTarget,
      tolerancePct: 50,
      source: 'NORAD−McDowell gen2 transit',
    },
    Polar: { count: 744, tolerancePct: 18, source: 'McDowell 70° shell' },
    'SSO Shell 1': { count: 233, tolerancePct: 25, source: 'McDowell 97.6° shell' },
    'SSO Shell 2': { count: 400, tolerancePct: 25, source: 'McDowell 97.4° shell' },
    Other: { count: 0, tolerancePct: 0, maxCount: 50, source: 'unclassified' },
  };
}

/** Expected Gen1-I count ≈ McDowell v1.0 segment. */
export const GEN1_I_TARGET = MCDOWELL_MODEL_COUNTS.v1;

/** Gen1-II is the bulk of v1.5 still operational at the 53° shell (subset of v15). */
export const GEN1_II_TARGET = Math.round(MCDOWELL_MODEL_COUNTS.v15 * 0.82);

/** Gen2 operational target ≈ full v2 mini family in McDowell working set. */
export const GEN2_TARGET = GENERATION_MIX_REFERENCE.gen2Hardware;

/** Transit buckets: NORAD-only raising/decay not in McDowell working (typical Δ NORAD−McDowell). */
export const NORAD_TRANSIT_DELTA = IMAGE_NORAD_TOTAL - MCDOWELL_WORKING_TOTAL;

export const GEN1_TRANSIT_TARGET = Math.round(NORAD_TRANSIT_DELTA * 0.35);
export const GEN2_TRANSIT_TARGET = Math.round(NORAD_TRANSIT_DELTA * 0.65);

/** Polar + SSO — McDowell inclination-group working estimates (May 2026). */
export const POLAR_TARGET = 744;
export const SSO_SHELL_1_TARGET = 233;
export const SSO_SHELL_2_TARGET = 400;

export const LIVE_SHELL_CATEGORY_TARGETS = buildLiveShellCategoryTargets();

/** Sum of category targets (may exceed McDowell working — buckets overlap hardware pools). */
export const CATEGORY_TARGETS_SUM = Object.values(LIVE_SHELL_CATEGORY_TARGETS).reduce(
  (sum, row) => sum + row.count,
  0
);
