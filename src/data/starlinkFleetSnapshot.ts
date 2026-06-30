/**
 * McDowell fleet snapshot — static export from Space-Industry-Data-Pipeline.
 * Sources: exports/active_vs_deorbited_sats.csv, exports/sat_model_segmentation.csv,
 * exports/bandwidth_vs_customers.csv (latest month_end row: 2026-05-31).
 * Regenerate: npm run sync:pipeline
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
  totalWorking: number;
  totalDown: number;
  models: StarlinkFleetModelCounts;
  totalBandwidthInOrbitTbps: number;
}

export const STARLINK_FLEET_SNAPSHOT: StarlinkFleetSnapshot = {
  snapshotDate: '2026-05-31',
  totalWorking: 10397,
  totalDown: 1619,
  models: {
    v1: 749,
    v15: 2574,
    v2Mini: 2574,
    v2MiniD2c: 644,
    v2MiniOpt: 3856,
  },
  totalBandwidthInOrbitTbps: 688.044,
};
