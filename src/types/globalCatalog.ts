export type GlobalCatalogViewScope = 'orbital' | 'all';
export type GlobalCatalogSatKind = 'payloads' | 'non_payloads';

export interface GlobalCatalogDashboard {
  total_launches_all_time?: number;
  orbital_launches?: number;
  successful_orbital_launches?: number;
  success_rate_pct?: number;
  total_satellites_catalogued?: number;
  active_satellites?: number;
  reentered_satellites?: number;
  unique_operators?: number;
  top_operator?: string;
  object_kinds?: GlobalCatalogObjectKindRow[];
}

export interface GlobalCatalogObjectKindRow {
  kind: string;
  label: string;
  total: number;
  active: number;
}

export interface GlobalCatalogFeeds {
  launches_per_year?: Record<string, unknown>[];
  satellites_per_year?: Record<string, unknown>[];
  top_operators?: Record<string, unknown>[];
  satellites_by_state?: Record<string, unknown>[];
  satellites_by_segment_per_year?: Record<string, unknown>[];
  satellites_by_kind_per_year?: Record<string, unknown>[];
  mass_to_orbit_per_year?: Record<string, unknown>[];
}

export type GlobalCatalogNested<T> =
  | T
  | {
      orbital?: T | GlobalCatalogScopedPayload<T>;
      all?: T | GlobalCatalogScopedPayload<T>;
      payloads?: T;
      non_payloads?: T;
      object_kinds?: GlobalCatalogObjectKindRow[];
    };

export interface GlobalCatalogScopedPayload<T> {
  payloads?: T;
  non_payloads?: T;
  object_kinds?: GlobalCatalogObjectKindRow[];
}

export interface GlobalCatalogSnapshot {
  snapshot_id: number;
  run_id: number | null;
  created_at: string;
  dashboard: GlobalCatalogNested<GlobalCatalogDashboard>;
  feeds: GlobalCatalogNested<GlobalCatalogFeeds>;
}

export interface GlobalCatalogReview {
  id: number;
  entity_type: string;
  entity_key: string;
  change_type?: string;
  status: string;
  created_at?: string;
}

export interface GlobalCatalogBootstrapStatus {
  done: boolean;
  can_run: boolean;
  global_launches_count: number;
  global_satellites_count: number;
}

export interface GlobalCatalogUpdateResult {
  run_id: number;
  status: string;
  new_launches: number;
  changed_launches: number;
  new_satellites: number;
  changed_satellites: number;
  pending_reviews: number;
  snapshot_id: number | null;
  notes?: string | null;
}
