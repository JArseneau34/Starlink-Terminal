/**
 * McDowell fleet snapshot — static export from sat-stats.
 * Sources: active_vs_deorbited_sats, sat_model_segmentation,
 * bandwidth_vs_customers (latest month_end row: 2026-07-31).
 * Regenerate: npm run sync:fleet-snapshot
 */

export interface StarlinkFleetModelCounts {
  v1: number;
  v15: number;
  v2Mini: number;
  v2MiniD2c: number;
  v2MiniOpt: number;
}

export interface StarlinkFleetSnapshot {
  snapshotDate: string;
  totalInOrbit: number;
  totalWorking: number;
  totalDown: number;
  models: StarlinkFleetModelCounts;
  totalBandwidthInOrbitTbps: number;
}

export const STARLINK_FLEET_SNAPSHOT: StarlinkFleetSnapshot = {
  snapshotDate: '2026-07-31',
  totalInOrbit: 10777,
  totalWorking: 10761,
  totalDown: 1695,
  models: {
    v1: 739,
    v15: 2515,
    v2Mini: 2572,
    v2MiniD2c: 640,
    v2MiniOpt: 4295,
  },
  totalBandwidthInOrbitTbps: 728.46,
};
