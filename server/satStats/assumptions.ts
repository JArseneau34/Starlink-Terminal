import type Database from 'better-sqlite3';

export interface ModelAssumptionRow {
  model_key: string;
  mass_kg: number;
  downlink_gbps_per_sat: number;
}

export interface SubscriberAnchorRow {
  anchor_date: string;
  subscribers: number;
  source: string | null;
}

export function listModelAssumptions(conn: Database.Database): ModelAssumptionRow[] {
  return conn
    .prepare('SELECT model_key, mass_kg, downlink_gbps_per_sat FROM model_assumptions ORDER BY model_key')
    .all() as ModelAssumptionRow[];
}

export function listSubscriberAnchors(conn: Database.Database): SubscriberAnchorRow[] {
  return conn
    .prepare('SELECT anchor_date, subscribers, source FROM subscriber_anchors ORDER BY anchor_date')
    .all() as SubscriberAnchorRow[];
}

export function upsertModelAssumption(
  conn: Database.Database,
  model: ModelAssumptionRow
): void {
  conn
    .prepare(
      `INSERT INTO model_assumptions(model_key, mass_kg, downlink_gbps_per_sat)
       VALUES (@model_key, @mass_kg, @downlink_gbps_per_sat)
       ON CONFLICT(model_key) DO UPDATE SET
         mass_kg=excluded.mass_kg,
         downlink_gbps_per_sat=excluded.downlink_gbps_per_sat`
    )
    .run(model);
}
