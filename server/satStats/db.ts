import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SAT_STATS_DB_PATH } from './config.js';

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS launch_archive (
  flight_no TEXT PRIMARY KEY,
  date_utc TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  booster TEXT,
  ship TEXT,
  launch_site TEXT,
  payload_type TEXT NOT NULL,
  payload TEXT,
  payload_mass_kg REAL,
  orbit TEXT,
  customer TEXT,
  launch_outcome TEXT,
  booster_landing TEXT,
  number_of_starlink_satellites INTEGER,
  starlink_model TEXT,
  of_which_dtc INTEGER,
  description TEXT,
  source_id TEXT,
  source_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS starlink_scraper_log (
  snapshot_date TEXT PRIMARY KEY,
  total_sats_launched INTEGER NOT NULL,
  disposal_complete INTEGER NOT NULL,
  total_down INTEGER NOT NULL,
  total_in_orbit INTEGER NOT NULL,
  total_working INTEGER NOT NULL,
  gbps_per_sat REAL,
  total_bandwidth_in_orbit_tbps REAL NOT NULL,
  active_v1 INTEGER NOT NULL,
  active_v15 INTEGER NOT NULL,
  active_v2_mini INTEGER NOT NULL,
  active_v2_mini_d2c INTEGER NOT NULL,
  active_v2_mini_opt INTEGER NOT NULL,
  down_v1 INTEGER NOT NULL,
  down_v15 INTEGER NOT NULL,
  down_v2_mini INTEGER NOT NULL,
  down_v2_mini_d2c INTEGER NOT NULL,
  down_v2_mini_opt INTEGER NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS subscriber_anchors (
  anchor_date TEXT PRIMARY KEY,
  subscribers INTEGER NOT NULL,
  source TEXT
);

CREATE TABLE IF NOT EXISTS model_assumptions (
  model_key TEXT PRIMARY KEY,
  mass_kg REAL NOT NULL,
  downlink_gbps_per_sat REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS fcc_attrition_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  generation TEXT NOT NULL,
  deorbited INTEGER NOT NULL DEFAULT 0,
  decommissioned INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  maneuvers INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  source_hash TEXT NOT NULL DEFAULT '',
  UNIQUE(report_date, generation)
);

CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  change_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  normalized_payload TEXT NOT NULL,
  diff_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  run_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  decided_by TEXT,
  decision_note TEXT
);

CREATE TABLE IF NOT EXISTS compute_snapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  run_id INTEGER,
  launch_data_json TEXT NOT NULL,
  starlink_data_json TEXT NOT NULL,
  feeds_json TEXT NOT NULL,
  dashboard_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS update_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS publish_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_diff_json TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  FOREIGN KEY(snapshot_id) REFERENCES compute_snapshots(snapshot_id)
);

CREATE TABLE IF NOT EXISTS bootstrap_flags (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_policy (
  source_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  terms_url TEXT,
  republish_allowed INTEGER NOT NULL DEFAULT 0,
  robots_respected INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);
`;

const DEFAULT_ANCHORS: [string, number, string][] = [
  ['2020-10-31', 0, 'Assumed (public beta ~Oct 2020)'],
  ['2021-02-28', 10_000, 'SpaceX announcement'],
  ['2022-12-31', 1_000_000, 'SpaceX announcement'],
  ['2024-09-30', 4_000_000, 'SpaceX announcement'],
  ['2025-12-31', 9_000_000, 'SpaceX announcement'],
  ['2026-02-28', 10_000_000, 'SpaceX announcement'],
];

const DEFAULT_MODELS: [string, number, number][] = [
  ['v0.9', 227, 12],
  ['v1', 260, 12],
  ['v1.5', 306, 24],
  ['v2 mini', 800, 96],
  ['v2 mini d2c', 900, 0],
  ['v2 mini opt', 575, 96],
  ['v3 starship', 2000, 1000],
];

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(SAT_STATS_DB_PATH), { recursive: true });
  db = new Database(SAT_STATS_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seedDefaults(db);
  return db;
}

function seedDefaults(conn: Database.Database): void {
  const insertAnchor = conn.prepare(
    'INSERT OR IGNORE INTO subscriber_anchors(anchor_date, subscribers, source) VALUES (?,?,?)'
  );
  for (const row of DEFAULT_ANCHORS) insertAnchor.run(...row);

  const insertModel = conn.prepare(
    'INSERT OR IGNORE INTO model_assumptions(model_key, mass_kg, downlink_gbps_per_sat) VALUES (?,?,?)'
  );
  for (const row of DEFAULT_MODELS) insertModel.run(...row);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
