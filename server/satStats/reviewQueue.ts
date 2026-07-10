import type Database from 'better-sqlite3';
import type { LaunchArchiveRow, StarlinkScraperLogRow } from './types.js';
import { STARLINK_MODELS } from './types.js';
import { appendApprovedSnapshotToSeedCsv } from './seed.js';

export function queueReviewItem(
  conn: Database.Database,
  params: {
    entity_type: string;
    entity_key: string;
    change_type: string;
    raw_payload: Record<string, unknown>;
    normalized_payload: Record<string, unknown>;
    diff_payload: Record<string, unknown>;
    run_id: number | null;
    status?: string;
  }
): number {
  const status = params.status ?? 'pending';
  const res = conn
    .prepare(
      `INSERT INTO review_queue(
        entity_type, entity_key, change_type, raw_payload, normalized_payload, diff_payload, status, run_id
      ) VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      params.entity_type,
      params.entity_key,
      params.change_type,
      JSON.stringify(params.raw_payload),
      JSON.stringify(params.normalized_payload),
      JSON.stringify(params.diff_payload),
      status,
      params.run_id
    );
  return Number(res.lastInsertRowid);
}

export function upsertLaunchRecord(conn: Database.Database, row: LaunchArchiveRow): void {
  conn
    .prepare(
      `INSERT INTO launch_archive(
        flight_no, date_utc, vehicle, booster, ship, launch_site, payload_type, payload,
        payload_mass_kg, orbit, customer, launch_outcome, booster_landing,
        number_of_starlink_satellites, starlink_model, of_which_dtc, description, source_id, source_hash
      ) VALUES (
        @flight_no, @date_utc, @vehicle, @booster, @ship, @launch_site, @payload_type, @payload,
        @payload_mass_kg, @orbit, @customer, @launch_outcome, @booster_landing,
        @number_of_starlink_satellites, @starlink_model, @of_which_dtc, @description, @source_id, @source_hash
      )
      ON CONFLICT(flight_no) DO UPDATE SET
        date_utc=excluded.date_utc, vehicle=excluded.vehicle, booster=excluded.booster, ship=excluded.ship,
        launch_site=excluded.launch_site, payload_type=excluded.payload_type, payload=excluded.payload,
        payload_mass_kg=excluded.payload_mass_kg, orbit=excluded.orbit, customer=excluded.customer,
        launch_outcome=excluded.launch_outcome, booster_landing=excluded.booster_landing,
        number_of_starlink_satellites=excluded.number_of_starlink_satellites,
        starlink_model=excluded.starlink_model, of_which_dtc=excluded.of_which_dtc,
        description=excluded.description, source_id=excluded.source_id, source_hash=excluded.source_hash`
    )
    .run(row);
}

export function upsertStarlinkSnapshot(
  conn: Database.Database,
  row: StarlinkScraperLogRow,
  syncHistoricalCsv = true
): void {
  conn
    .prepare(
      `INSERT INTO starlink_scraper_log(
        snapshot_date, total_sats_launched, disposal_complete, total_down, total_in_orbit, total_working,
        gbps_per_sat, total_bandwidth_in_orbit_tbps,
        active_v1, active_v15, active_v2_mini, active_v2_mini_d2c, active_v2_mini_opt,
        down_v1, down_v15, down_v2_mini, down_v2_mini_d2c, down_v2_mini_opt,
        source_id, source_hash
      ) VALUES (
        @snapshot_date, @total_sats_launched, @disposal_complete, @total_down, @total_in_orbit, @total_working,
        @gbps_per_sat, @total_bandwidth_in_orbit_tbps,
        @active_v1, @active_v15, @active_v2_mini, @active_v2_mini_d2c, @active_v2_mini_opt,
        @down_v1, @down_v15, @down_v2_mini, @down_v2_mini_d2c, @down_v2_mini_opt,
        @source_id, @source_hash
      )
      ON CONFLICT(snapshot_date) DO UPDATE SET
        total_sats_launched=excluded.total_sats_launched, disposal_complete=excluded.disposal_complete,
        total_down=excluded.total_down, total_in_orbit=excluded.total_in_orbit, total_working=excluded.total_working,
        gbps_per_sat=excluded.gbps_per_sat, total_bandwidth_in_orbit_tbps=excluded.total_bandwidth_in_orbit_tbps,
        active_v1=excluded.active_v1, active_v15=excluded.active_v15, active_v2_mini=excluded.active_v2_mini,
        active_v2_mini_d2c=excluded.active_v2_mini_d2c, active_v2_mini_opt=excluded.active_v2_mini_opt,
        down_v1=excluded.down_v1, down_v15=excluded.down_v15, down_v2_mini=excluded.down_v2_mini,
        down_v2_mini_d2c=excluded.down_v2_mini_d2c, down_v2_mini_opt=excluded.down_v2_mini_opt,
        source_id=excluded.source_id, source_hash=excluded.source_hash`
    )
    .run(row);
  if (syncHistoricalCsv) appendApprovedSnapshotToSeedCsv(row);
}

export function applyReviewApproval(
  conn: Database.Database,
  entityType: string,
  normalizedPayload: Record<string, unknown>,
  editedPayload?: Record<string, unknown> | null
): void {
  const payload = { ...normalizedPayload, ...(editedPayload ?? {}) };
  if (entityType === 'bulk_trueup') {
    const launches = (payload.launches ?? []) as LaunchArchiveRow[];
    const snapshot = (payload.snapshot ?? null) as StarlinkScraperLogRow | null;
    for (const launch of launches) {
      upsertLaunchRecord(conn, launch);
    }
    if (snapshot) {
      upsertStarlinkSnapshot(conn, snapshot, true);
    }
    return;
  }
  if (entityType === 'launch_archive') {
    upsertLaunchRecord(conn, payload as unknown as LaunchArchiveRow);
    return;
  }
  if (entityType === 'starlink_scraper_log') {
    upsertStarlinkSnapshot(conn, payload as unknown as StarlinkScraperLogRow, true);
    return;
  }
  throw new Error(`Unsupported entity_type: ${entityType}`);
}

export function reviewStatusForLaunch(row: LaunchArchiveRow): 'pending' | 'needs_assumption' {
  if (row.starlink_model && !STARLINK_MODELS.has(row.starlink_model)) return 'needs_assumption';
  return 'pending';
}

export function listPendingReviews(conn: Database.Database): Record<string, unknown>[] {
  return conn
    .prepare(
      `SELECT * FROM review_queue WHERE status IN ('pending','needs_assumption') ORDER BY created_at DESC`
    )
    .all() as Record<string, unknown>[];
}

export function getReview(conn: Database.Database, id: number): Record<string, unknown> | null {
  const row = conn.prepare('SELECT * FROM review_queue WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ?? null;
}

export function updateReviewStatus(
  conn: Database.Database,
  id: number,
  status: string,
  reviewer: string,
  note?: string
): void {
  conn
    .prepare(
      `UPDATE review_queue SET status=?, decided_at=CURRENT_TIMESTAMP, decided_by=?, decision_note=? WHERE id=?`
    )
    .run(status, reviewer, note ?? null, id);
}

export function approveReview(
  conn: Database.Database,
  id: number,
  reviewer: string,
  editedPayload?: Record<string, unknown> | null
): void {
  const row = getReview(conn, id);
  if (!row) throw new Error(`Review ${id} not found`);
  const normalized = JSON.parse(String(row.normalized_payload)) as Record<string, unknown>;
  applyReviewApproval(conn, String(row.entity_type), normalized, editedPayload);
  updateReviewStatus(conn, id, 'approved', reviewer, 'approved');
}

export function approveAllPendingReviews(conn: Database.Database, reviewer: string): {
  approved_ids: number[];
  failed: { id: number; error: string }[];
} {
  const ids = conn
    .prepare(`SELECT id FROM review_queue WHERE status IN ('pending','needs_assumption') ORDER BY id`)
    .all() as { id: number }[];
  const approved_ids: number[] = [];
  const failed: { id: number; error: string }[] = [];
  for (const { id } of ids) {
    try {
      approveReview(conn, id, reviewer);
      approved_ids.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { approved_ids, failed };
}
