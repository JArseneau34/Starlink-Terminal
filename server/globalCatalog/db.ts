import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { GLOBAL_CATALOG_DB_PATH } from './config.js';

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS global_launches (
  launch_tag TEXT PRIMARY KEY,
  launch_jd REAL,
  launch_date TEXT,
  launch_date_iso TEXT,
  lv_type TEXT,
  variant TEXT,
  flight_id TEXT,
  flight TEXT,
  mission TEXT,
  flight_code TEXT,
  platform TEXT,
  launch_site TEXT,
  launch_pad TEXT,
  ascent_site TEXT,
  ascent_pad TEXT,
  apogee_km REAL,
  apo_flag TEXT,
  range_km REAL,
  range_flag TEXT,
  dest TEXT,
  orb_pay TEXT,
  agency TEXT,
  launch_code TEXT,
  fail_code TEXT,
  launch_group TEXT,
  category TEXT,
  lt_cite TEXT,
  cite TEXT,
  notes TEXT,
  source_hash TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_global_launches_date ON global_launches(launch_date_iso);
CREATE INDEX IF NOT EXISTS idx_global_launches_agency ON global_launches(agency);
CREATE INDEX IF NOT EXISTS idx_global_launches_category ON global_launches(category);

CREATE TABLE IF NOT EXISTS global_satellites (
  jcat TEXT PRIMARY KEY,
  satcat TEXT,
  launch_tag TEXT,
  piece TEXT,
  object_type TEXT,
  name TEXT,
  pl_name TEXT,
  l_date TEXT,
  l_date_iso TEXT,
  parent TEXT,
  s_date TEXT,
  primary_body TEXT,
  d_date TEXT,
  d_date_iso TEXT,
  status TEXT,
  dest TEXT,
  owner TEXT,
  state TEXT,
  manufacturer TEXT,
  bus TEXT,
  motor TEXT,
  mass_kg REAL,
  mass_flag TEXT,
  dry_mass_kg REAL,
  dry_flag TEXT,
  tot_mass_kg REAL,
  tot_flag TEXT,
  length_m REAL,
  length_flag TEXT,
  diameter_m REAL,
  diameter_flag TEXT,
  span_m REAL,
  span_flag TEXT,
  shape TEXT,
  o_date TEXT,
  perigee_km REAL,
  perigee_flag TEXT,
  apogee_km REAL,
  apogee_flag TEXT,
  inc_deg REAL,
  inc_flag TEXT,
  op_orbit TEXT,
  oqual TEXT,
  alt_names TEXT,
  source_hash TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_global_satellites_status ON global_satellites(status);
CREATE INDEX IF NOT EXISTS idx_global_satellites_state ON global_satellites(state);
CREATE INDEX IF NOT EXISTS idx_global_satellites_owner ON global_satellites(owner);
CREATE INDEX IF NOT EXISTS idx_global_satellites_launch_tag ON global_satellites(launch_tag);
CREATE INDEX IF NOT EXISTS idx_global_satellites_ldate ON global_satellites(l_date_iso);

CREATE TABLE IF NOT EXISTS bootstrap_flags (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_compute_snapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  run_id INTEGER,
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
`;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(GLOBAL_CATALOG_DB_PATH), { recursive: true });
  db = new Database(GLOBAL_CATALOG_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function createUpdateRun(conn: Database.Database): number {
  const res = conn.prepare(`INSERT INTO update_runs(status) VALUES ('running')`).run();
  return Number(res.lastInsertRowid);
}

export function completeUpdateRun(
  conn: Database.Database,
  runId: number,
  status: string,
  notes: string | null
): void {
  conn
    .prepare(`UPDATE update_runs SET status=?, completed_at=CURRENT_TIMESTAMP, notes=? WHERE id=?`)
    .run(status, notes, runId);
}
