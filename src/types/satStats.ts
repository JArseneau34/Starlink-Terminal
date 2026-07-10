export interface SatStatsDashboard {
  total_launches_all_time?: number;
  active_satellites?: number;
  est_customers?: number;
  constellation_bw_tbps?: number;
  deorbited_satellites?: number;
}

export type SatStatsFeedKey =
  | 'launches_by_vehicle'
  | 'bandwidth_vs_customers'
  | 'active_vs_deorbited_sats'
  | 'bandwidth_density_vs_satlaunch'
  | 'sat_model_segmentation'
  | 'starlink_vs_customer_share';

export interface SatStatsSnapshot {
  snapshot_id: number;
  run_id: number | null;
  created_at: string;
  launch_data: Record<string, unknown>[];
  starlink_data: Record<string, unknown>[];
  feeds: Record<SatStatsFeedKey, Record<string, unknown>[]>;
  dashboard: SatStatsDashboard;
}

export interface SatStatsReview {
  id: number;
  entity_type: string;
  entity_key: string;
  change_type: string;
  status: string;
  created_at?: string;
  diff_payload?: Record<string, unknown> | string;
}

export interface SatStatsModelAssumption {
  model_key: string;
  mass_kg: number;
  downlink_gbps_per_sat: number;
}

export interface SatStatsUpdateResult {
  run_id: number;
  status: string;
  new_records: number;
  changed_records: number;
  pending_reviews: number;
  needs_assumption_count: number;
  snapshot_id: number | null;
  notes: string[];
}

export const MODEL_OPTIONS = [
  { key: 'v1', label: 'V1' },
  { key: 'v1.5', label: 'V1.5' },
  { key: 'v2 mini', label: 'V2 Mini' },
  { key: 'v2 mini d2c', label: 'V2 DTC' },
  { key: 'v2 mini opt', label: 'V2 Mini Opt' },
  { key: 'v3 starship', label: 'V3 Starship' },
] as const;
