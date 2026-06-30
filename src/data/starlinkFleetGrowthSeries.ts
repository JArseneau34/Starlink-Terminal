/**
 * Monthly working-fleet growth — static export from Space-Industry-Data-Pipeline.
 * Joins exports/active_vs_deorbited_sats.csv with exports/bandwidth_vs_customers.csv on month_end
 * (21 rows with a non-zero working fleet).
 * Regenerate: npm run sync:pipeline
 */

export interface StarlinkFleetGrowthMonth {
  monthEnd: string;
  activeSatellites: number;
  deorbitedSatellites: number;
  totalBandwidthTbps: number;
}

export const STARLINK_FLEET_GROWTH_SERIES: StarlinkFleetGrowthMonth[] = [
  {
    "monthEnd": "2024-09-30",
    "activeSatellites": 6371,
    "deorbitedSatellites": 636,
    "totalBandwidthTbps": 193.45
  },
  {
    "monthEnd": "2024-10-31",
    "activeSatellites": 6504,
    "deorbitedSatellites": 647,
    "totalBandwidthTbps": 202
  },
  {
    "monthEnd": "2024-11-30",
    "activeSatellites": 6736,
    "deorbitedSatellites": 661,
    "totalBandwidthTbps": 216
  },
  {
    "monthEnd": "2024-12-31",
    "activeSatellites": 6820,
    "deorbitedSatellites": 666,
    "totalBandwidthTbps": 221.6
  },
  {
    "monthEnd": "2025-01-31",
    "activeSatellites": 6957,
    "deorbitedSatellites": 746,
    "totalBandwidthTbps": 236.7
  },
  {
    "monthEnd": "2025-02-28",
    "activeSatellites": 7063,
    "deorbitedSatellites": 925,
    "totalBandwidthTbps": 389.2
  },
  {
    "monthEnd": "2025-03-31",
    "activeSatellites": 7099,
    "deorbitedSatellites": 983,
    "totalBandwidthTbps": 397.1
  },
  {
    "monthEnd": "2025-04-30",
    "activeSatellites": 7282,
    "deorbitedSatellites": 1059,
    "totalBandwidthTbps": 420.1
  },
  {
    "monthEnd": "2025-05-31",
    "activeSatellites": 7627,
    "deorbitedSatellites": 1112,
    "totalBandwidthTbps": 456.6
  },
  {
    "monthEnd": "2025-06-30",
    "activeSatellites": 7901,
    "deorbitedSatellites": 1147,
    "totalBandwidthTbps": 485.1
  },
  {
    "monthEnd": "2025-07-31",
    "activeSatellites": 8075,
    "deorbitedSatellites": 1177,
    "totalBandwidthTbps": 503.988
  },
  {
    "monthEnd": "2025-08-31",
    "activeSatellites": 8075,
    "deorbitedSatellites": 1177,
    "totalBandwidthTbps": 503.988
  },
  {
    "monthEnd": "2025-09-30",
    "activeSatellites": 8527,
    "deorbitedSatellites": 1249,
    "totalBandwidthTbps": 489.144
  },
  {
    "monthEnd": "2025-10-31",
    "activeSatellites": 8527,
    "deorbitedSatellites": 1249,
    "totalBandwidthTbps": 489.144
  },
  {
    "monthEnd": "2025-11-30",
    "activeSatellites": 8527,
    "deorbitedSatellites": 1249,
    "totalBandwidthTbps": 489.144
  },
  {
    "monthEnd": "2025-12-31",
    "activeSatellites": 8527,
    "deorbitedSatellites": 1249,
    "totalBandwidthTbps": 489.144
  },
  {
    "monthEnd": "2026-01-31",
    "activeSatellites": 9603,
    "deorbitedSatellites": 1385,
    "totalBandwidthTbps": 600.924
  },
  {
    "monthEnd": "2026-02-28",
    "activeSatellites": 9603,
    "deorbitedSatellites": 1385,
    "totalBandwidthTbps": 600.924
  },
  {
    "monthEnd": "2026-03-31",
    "activeSatellites": 10130,
    "deorbitedSatellites": 1527,
    "totalBandwidthTbps": 657.06
  },
  {
    "monthEnd": "2026-04-30",
    "activeSatellites": 10280,
    "deorbitedSatellites": 1581,
    "totalBandwidthTbps": 674.94
  },
  {
    "monthEnd": "2026-05-31",
    "activeSatellites": 10397,
    "deorbitedSatellites": 1619,
    "totalBandwidthTbps": 688.044
  }
];
