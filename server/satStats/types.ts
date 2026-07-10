export type SatStatsSourceId =
  | 'celestrak'
  | 'spacetrack'
  | 'launch_library_2'
  | 'fcc'
  | 'fcc_attrition_trueup'
  | 'spacex_press'
  | 'mcdowell'
  | 'wikipedia_bootstrap'
  | 'wikipedia_trueup';

export type ReviewStatus = 'pending' | 'needs_assumption' | 'approved' | 'rejected';

export interface LaunchArchiveRow {
  flight_no: string;
  date_utc: string;
  vehicle: string;
  booster: string | null;
  ship: string | null;
  launch_site: string | null;
  payload_type: string;
  payload: string | null;
  payload_mass_kg: number | null;
  orbit: string | null;
  customer: string | null;
  launch_outcome: string | null;
  booster_landing: string | null;
  number_of_starlink_satellites: number | null;
  starlink_model: string | null;
  of_which_dtc: number | null;
  description: string | null;
  source_id?: SatStatsSourceId;
  source_hash?: string;
}

export interface StarlinkScraperLogRow {
  snapshot_date: string;
  total_sats_launched: number;
  disposal_complete: number;
  total_down: number;
  total_in_orbit: number;
  total_working: number;
  gbps_per_sat: number | null;
  total_bandwidth_in_orbit_tbps: number;
  active_v1: number;
  active_v15: number;
  active_v2_mini: number;
  active_v2_mini_d2c: number;
  active_v2_mini_opt: number;
  down_v1: number;
  down_v15: number;
  down_v2_mini: number;
  down_v2_mini_d2c: number;
  down_v2_mini_opt: number;
  source_id?: SatStatsSourceId;
  source_hash?: string;
}

export interface FccAttritionSnapshot {
  report_date: string;
  generation: string;
  deorbited: number;
  decommissioned: number;
  failed: number;
  maneuvers: number;
  source_url: string;
}

export interface AdapterFetchResult {
  source: SatStatsSourceId;
  ok: boolean;
  error?: string;
  landingPath?: string;
  launches?: LaunchArchiveRow[];
  fleetSnapshots?: StarlinkScraperLogRow[];
  fccAttrition?: FccAttritionSnapshot[];
  notes?: string[];
}

export interface UpdateRunResult {
  run_id: number;
  status: 'complete' | 'partial' | 'failed';
  new_records: number;
  changed_records: number;
  pending_reviews: number;
  needs_assumption_count: number;
  snapshot_id: number | null;
  notes: string[];
  source_results: AdapterFetchResult[];
}

export interface SatStatsSnapshot {
  snapshot_id: number;
  run_id: number | null;
  created_at: string;
  launch_data: Record<string, unknown>[];
  starlink_data: Record<string, unknown>[];
  feeds: Record<string, Record<string, unknown>[]>;
  dashboard: Record<string, unknown>;
}

export const STARLINK_MODELS = new Set([
  'v0.9',
  'v1',
  'v1.5',
  'v2 mini',
  'v2 mini d2c',
  'v2 mini opt',
  'v3 starship',
]);

export const CHART_FEED_KEYS = [
  'launches_by_vehicle',
  'bandwidth_vs_customers',
  'active_vs_deorbited_sats',
  'bandwidth_density_vs_satlaunch',
  'sat_model_segmentation',
  'starlink_vs_customer_share',
] as const;
