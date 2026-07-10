/**
 * FCC semi-annual attrition cumulative totals — used to apportion per-generation
 * down_* fields on the McDowell snapshot. Update when a new filing is published.
 */

export interface FccAttritionCumulative {
  reportDate: string;
  source: string;
  notes: string;
  /** Cumulative Gen1 attrition (v1 + v1.5 family). */
  gen1Deorbited: number;
  /** Cumulative Gen2 attrition (v2 mini family). */
  gen2Deorbited: number;
  /** Model-level Gen1 split within gen1Deorbited (McDowell/FCC mix). */
  gen1ModelRatio: { v1: number; v15: number };
  /** Model-level Gen2 split within gen2Deorbited. */
  gen2ModelRatio: { v2Mini: number; v2MiniD2c: number; v2MiniOpt: number };
}

/** SpaceX FCC semi-annual attrition cumulative — Nov 2025 reporting period. */
export const FCC_ATTRITION_LATEST: FccAttritionCumulative = {
  reportDate: '2025-11-30',
  source: 'FCC IBFS semi-annual SpaceX attrition report',
  notes:
    'Cumulative disposed satellites by authorization generation. Gen2 sub-model split from latest McDowell column ratios.',
  gen1Deorbited: 1447,
  gen2Deorbited: 248,
  gen1ModelRatio: { v1: 1037, v15: 410 },
  gen2ModelRatio: { v2Mini: 193, v2MiniD2c: 34, v2MiniOpt: 21 },
};

function splitByRatio(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map((v) => Math.floor(v));
  let rem = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let r = 0; r < rem; r++) {
    floored[order[r % order.length]!.i]!++;
  }
  return floored;
}

export function apportionDeorbitedByGeneration(totalDown: number): {
  down_v1: number;
  down_v15: number;
  down_v2_mini: number;
  down_v2_mini_d2c: number;
  down_v2_mini_opt: number;
} {
  const ref = FCC_ATTRITION_LATEST;
  const fccSum = ref.gen1Deorbited + ref.gen2Deorbited || 1;
  const gen1 = Math.round(totalDown * (ref.gen1Deorbited / fccSum));
  const gen2 = totalDown - gen1;
  const [down_v1, down_v15] = splitByRatio(gen1, [ref.gen1ModelRatio.v1, ref.gen1ModelRatio.v15]);
  const [down_v2_mini, down_v2_mini_d2c, down_v2_mini_opt] = splitByRatio(gen2, [
    ref.gen2ModelRatio.v2Mini,
    ref.gen2ModelRatio.v2MiniD2c,
    ref.gen2ModelRatio.v2MiniOpt,
  ]);
  return { down_v1, down_v15, down_v2_mini, down_v2_mini_d2c, down_v2_mini_opt };
}
