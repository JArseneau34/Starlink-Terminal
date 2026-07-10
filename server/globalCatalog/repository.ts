import type Database from 'better-sqlite3';
import { stableHash } from './hash.js';

export const GLOBAL_LAUNCH_COLUMNS = [
  'launch_tag',
  'launch_jd',
  'launch_date',
  'launch_date_iso',
  'lv_type',
  'variant',
  'flight_id',
  'flight',
  'mission',
  'flight_code',
  'platform',
  'launch_site',
  'launch_pad',
  'ascent_site',
  'ascent_pad',
  'apogee_km',
  'apo_flag',
  'range_km',
  'range_flag',
  'dest',
  'orb_pay',
  'agency',
  'launch_code',
  'fail_code',
  'launch_group',
  'category',
  'lt_cite',
  'cite',
  'notes',
] as const;

export const GLOBAL_SATELLITE_COLUMNS = [
  'jcat',
  'satcat',
  'launch_tag',
  'piece',
  'object_type',
  'name',
  'pl_name',
  'l_date',
  'l_date_iso',
  'parent',
  's_date',
  'primary_body',
  'd_date',
  'd_date_iso',
  'status',
  'dest',
  'owner',
  'state',
  'manufacturer',
  'bus',
  'motor',
  'mass_kg',
  'mass_flag',
  'dry_mass_kg',
  'dry_flag',
  'tot_mass_kg',
  'tot_flag',
  'length_m',
  'length_flag',
  'diameter_m',
  'diameter_flag',
  'span_m',
  'span_flag',
  'shape',
  'o_date',
  'perigee_km',
  'perigee_flag',
  'apogee_km',
  'apogee_flag',
  'inc_deg',
  'inc_flag',
  'op_orbit',
  'oqual',
  'alt_names',
] as const;

export type ChangeType = 'inserted' | 'updated' | 'unchanged';

type RowPayload = Record<string, string | number | null | undefined>;

function normalize(payload: RowPayload, columns: readonly string[]): Record<string, string | number | null> {
  const record: Record<string, string | number | null> = {};
  for (const col of columns) record[col] = payload[col] ?? null;
  return record;
}

function rowHash(payload: Record<string, string | number | null>): string {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) normalized[k] = v == null ? '' : v;
  return stableHash(normalized);
}

export function globalLaunchRowHash(payload: RowPayload): string {
  return rowHash(normalize(payload, GLOBAL_LAUNCH_COLUMNS));
}

export function globalSatelliteRowHash(payload: RowPayload): string {
  return rowHash(normalize(payload, GLOBAL_SATELLITE_COLUMNS));
}

export function upsertGlobalLaunch(
  conn: Database.Database,
  payload: RowPayload
): [ChangeType, string] {
  const record = normalize(payload, GLOBAL_LAUNCH_COLUMNS);
  const key = String(record.launch_tag ?? '');
  if (!key) throw new Error('global_launches payload missing launch_tag');

  const payloadHash = rowHash(record);
  const existing = conn
    .prepare('SELECT source_hash FROM global_launches WHERE launch_tag = ?')
    .get(key) as { source_hash: string } | undefined;

  const cols = [...GLOBAL_LAUNCH_COLUMNS];
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const columnList = cols.join(', ');
  const bind = { ...record, source_hash: payloadHash };

  if (!existing) {
    conn
      .prepare(`INSERT INTO global_launches(${columnList}, source_hash) VALUES(${placeholders}, @source_hash)`)
      .run(bind);
    return ['inserted', key];
  }
  if (existing.source_hash === payloadHash) return ['unchanged', key];

  const assignments = cols
    .filter((c) => c !== 'launch_tag')
    .map((c) => `${c}=@${c}`)
    .join(', ');
  conn
    .prepare(`UPDATE global_launches SET ${assignments}, source_hash=@source_hash WHERE launch_tag=@launch_tag`)
    .run(bind);
  return ['updated', key];
}

export function upsertGlobalSatellite(
  conn: Database.Database,
  payload: RowPayload
): [ChangeType, string] {
  const record = normalize(payload, GLOBAL_SATELLITE_COLUMNS);
  const key = String(record.jcat ?? '');
  if (!key) throw new Error('global_satellites payload missing jcat');

  const payloadHash = rowHash(record);
  const existing = conn
    .prepare('SELECT source_hash FROM global_satellites WHERE jcat = ?')
    .get(key) as { source_hash: string } | undefined;

  const cols = [...GLOBAL_SATELLITE_COLUMNS];
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const columnList = cols.join(', ');
  const bind = { ...record, source_hash: payloadHash };

  if (!existing) {
    conn
      .prepare(`INSERT INTO global_satellites(${columnList}, source_hash) VALUES(${placeholders}, @source_hash)`)
      .run(bind);
    return ['inserted', key];
  }
  if (existing.source_hash === payloadHash) return ['unchanged', key];

  const assignments = cols
    .filter((c) => c !== 'jcat')
    .map((c) => `${c}=@${c}`)
    .join(', ');
  conn
    .prepare(`UPDATE global_satellites SET ${assignments}, source_hash=@source_hash WHERE jcat=@jcat`)
    .run(bind);
  return ['updated', key];
}

export function existingGlobalLaunchHashes(conn: Database.Database): Map<string, string> {
  const rows = conn.prepare('SELECT launch_tag, source_hash FROM global_launches').all() as Array<{
    launch_tag: string;
    source_hash: string;
  }>;
  return new Map(rows.map((r) => [r.launch_tag, r.source_hash]));
}

export function existingGlobalSatelliteHashes(conn: Database.Database): Map<string, string> {
  const rows = conn.prepare('SELECT jcat, source_hash FROM global_satellites').all() as Array<{
    jcat: string;
    source_hash: string;
  }>;
  return new Map(rows.map((r) => [r.jcat, r.source_hash]));
}

export function globalLaunchesCount(conn: Database.Database): number {
  const row = conn.prepare('SELECT COUNT(*) AS n FROM global_launches').get() as { n: number };
  return Number(row.n);
}

export function globalSatellitesCount(conn: Database.Database): number {
  const row = conn.prepare('SELECT COUNT(*) AS n FROM global_satellites').get() as { n: number };
  return Number(row.n);
}

export function loadAllGlobalLaunches(conn: Database.Database): Record<string, unknown>[] {
  return conn.prepare('SELECT * FROM global_launches ORDER BY launch_date_iso DESC').all() as Record<
    string,
    unknown
  >[];
}

export function loadAllGlobalSatellites(conn: Database.Database): Record<string, unknown>[] {
  return conn.prepare('SELECT * FROM global_satellites ORDER BY l_date_iso DESC').all() as Record<
    string,
    unknown
  >[];
}
