import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { HISTORICAL_STARLINK_SEED_CSV } from './config.js';
import type { StarlinkScraperLogRow } from './types.js';
import { stableHash } from './hash.js';

function parseIntCell(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  return Math.round(Number(cleaned)) || 0;
}

function parseFloatCell(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBandwidthTbps(raw: string | undefined): number {
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  if (lower.includes('tbps')) {
    return parseFloatCell(lower.replace('tbps', '')) ?? 0;
  }
  const n = parseFloatCell(raw) ?? 0;
  return n > 10_000 ? n / 1000 : n;
}

function parseDateCell(raw: string): string | null {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }
  return null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

function rowFromCsv(cells: string[]): StarlinkScraperLogRow | null {
  if (cells.length < 18) return null;
  const snapshot_date = parseDateCell(cells[0] ?? '');
  if (!snapshot_date) return null;
  const row: StarlinkScraperLogRow = {
    snapshot_date,
    total_sats_launched: parseIntCell(cells[1]),
    disposal_complete: parseIntCell(cells[2]),
    total_down: parseIntCell(cells[3]),
    total_in_orbit: parseIntCell(cells[4]),
    total_working: parseIntCell(cells[5]),
    gbps_per_sat: parseFloatCell(cells[6]),
    total_bandwidth_in_orbit_tbps: parseBandwidthTbps(cells[7]),
    active_v1: parseIntCell(cells[8]),
    active_v15: parseIntCell(cells[9]),
    active_v2_mini: parseIntCell(cells[10]),
    active_v2_mini_d2c: parseIntCell(cells[11]),
    active_v2_mini_opt: parseIntCell(cells[12]),
    down_v1: parseIntCell(cells[13]),
    down_v15: parseIntCell(cells[14]),
    down_v2_mini: parseIntCell(cells[15]),
    down_v2_mini_d2c: parseIntCell(cells[16]),
    down_v2_mini_opt: parseIntCell(cells[17]),
    source_id: 'mcdowell',
  };
  row.source_hash = stableHash(row);
  return row;
}

export function loadHistoricalSeedRows(): StarlinkScraperLogRow[] {
  if (!fs.existsSync(HISTORICAL_STARLINK_SEED_CSV)) return [];
  const text = fs.readFileSync(HISTORICAL_STARLINK_SEED_CSV, 'utf8');
  const rows = parseCsv(text);
  const dataRows = rows.slice(2);
  const out: StarlinkScraperLogRow[] = [];
  for (const cells of dataRows) {
    const row = rowFromCsv(cells);
    if (row) out.push(row);
  }
  return out;
}

export function seedStarlinkHistoryIfEmpty(conn: Database.Database): number {
  const count = conn.prepare('SELECT COUNT(*) AS c FROM starlink_scraper_log').get() as { c: number };
  if (count.c > 0) return 0;
  const rows = loadHistoricalSeedRows();
  if (!rows.length) return 0;
  const insert = conn.prepare(`
    INSERT OR IGNORE INTO starlink_scraper_log(
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
  `);
  let n = 0;
  for (const row of rows) {
    const res = insert.run(row);
    if (res.changes) n++;
  }
  return n;
}

export function appendApprovedSnapshotToSeedCsv(row: StarlinkScraperLogRow): void {
  const header =
    'Date,Total Sats Launched,Disposal Complete,Total Down,Total In Orbit,Total Working,Gbps/Sat,Total Bandwidth in Orbit,V1,V1.5,V2 Mini,V2 Mini D2C,V2 Mini Opt,V1,V1.5,V2 Mini,V2 Mini D2C,V2 Mini Opt';
  const line = [
    row.snapshot_date,
    row.total_sats_launched,
    row.disposal_complete,
    row.total_down,
    row.total_in_orbit,
    row.total_working,
    row.gbps_per_sat ?? '',
    `${row.total_bandwidth_in_orbit_tbps} Tbps`,
    row.active_v1,
    row.active_v15,
    row.active_v2_mini,
    row.active_v2_mini_d2c,
    row.active_v2_mini_opt,
    row.down_v1,
    row.down_v15,
    row.down_v2_mini,
    row.down_v2_mini_d2c,
    row.down_v2_mini_opt,
  ].join(',');
  if (!fs.existsSync(HISTORICAL_STARLINK_SEED_CSV)) {
    fs.mkdirSync(path.dirname(HISTORICAL_STARLINK_SEED_CSV), { recursive: true });
    fs.writeFileSync(HISTORICAL_STARLINK_SEED_CSV, `${header}\n${line}\n`, 'utf8');
    return;
  }
  const text = fs.readFileSync(HISTORICAL_STARLINK_SEED_CSV, 'utf8');
  if (text.includes(`${row.snapshot_date},`)) return;
  fs.appendFileSync(HISTORICAL_STARLINK_SEED_CSV, `${line}\n`, 'utf8');
}
