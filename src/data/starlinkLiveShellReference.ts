/**
 * Live catalog verification reference.
 *
 * - **Image taxonomy** — nine mission/orbit buckets (Gen1-I … Other) from the user's
 *   reference shell image; used for live-mode display and classification targets.
 * - **McDowell working** — authoritative fleet total and hardware generation mix
 *   from STARLINK_FLEET_SNAPSHOT (sync:pipeline / Jonathan McDowell).
 *
 * The image NORAD total (~10,548) includes raising/decay TLEs beyond McDowell
 * "working"; live catalog counts should reconcile to McDowell first.
 */

import { STARLINK_FLEET_SNAPSHOT } from './starlinkFleetSnapshot';

/** NORAD-tracked total shown on the user's reference image (includes non-working TLEs). */
export const IMAGE_NORAD_TOTAL = 10_548;

/** McDowell working fleet — primary live-catalog count target. */
export const MCDOWELL_WORKING_TOTAL = STARLINK_FLEET_SNAPSHOT.totalWorking;

export const MCDOWELL_MODEL_COUNTS = STARLINK_FLEET_SNAPSHOT.models;

/**
 * Map McDowell hardware segments → image mission buckets (generation families).
 * Orbit-specific buckets (Polar, SSO) draw from both v1.5 and v2 populations.
 */
export const GENERATION_MIX_REFERENCE = {
  gen1Hardware: MCDOWELL_MODEL_COUNTS.v1 + MCDOWELL_MODEL_COUNTS.v15,
  gen2Hardware:
    MCDOWELL_MODEL_COUNTS.v2Mini +
    MCDOWELL_MODEL_COUNTS.v2MiniD2c +
    MCDOWELL_MODEL_COUNTS.v2MiniOpt,
  v1: MCDOWELL_MODEL_COUNTS.v1,
  v15: MCDOWELL_MODEL_COUNTS.v15,
  v2Mini: MCDOWELL_MODEL_COUNTS.v2Mini,
  v2MiniD2c: MCDOWELL_MODEL_COUNTS.v2MiniD2c,
  v2MiniOpt: MCDOWELL_MODEL_COUNTS.v2MiniOpt,
} as const;

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

export const LIVE_SHELL_CATEGORY_TARGETS: Record<
  string,
  { count: number; tolerancePct: number; maxCount?: number; source: string }
> = {
  'Gen1-I': { count: GEN1_I_TARGET, tolerancePct: 20, source: 'McDowell v1.0' },
  'Gen1-II': { count: GEN1_II_TARGET, tolerancePct: 18, source: 'McDowell v1.5 @ 53°' },
  'Gen1-Transit': {
    count: GEN1_TRANSIT_TARGET,
    tolerancePct: 50,
    source: 'NORAD−McDowell gen1 transit',
  },
  Gen2: { count: GEN2_TARGET, tolerancePct: 12, source: 'McDowell v2 mini family' },
  'Gen2-Transit': {
    count: GEN2_TRANSIT_TARGET,
    tolerancePct: 50,
    source: 'NORAD−McDowell gen2 transit',
  },
  Polar: { count: POLAR_TARGET, tolerancePct: 18, source: 'McDowell 70° shell' },
  'SSO Shell 1': { count: SSO_SHELL_1_TARGET, tolerancePct: 25, source: 'McDowell 97.6° shell' },
  'SSO Shell 2': { count: SSO_SHELL_2_TARGET, tolerancePct: 25, source: 'McDowell 97.4° shell' },
  Other: { count: 0, tolerancePct: 0, maxCount: 50, source: 'unclassified' },
};

/** Sum of category targets (may exceed McDowell working — buckets overlap hardware pools). */
export const CATEGORY_TARGETS_SUM = Object.values(LIVE_SHELL_CATEGORY_TARGETS).reduce(
  (sum, row) => sum + row.count,
  0
);
