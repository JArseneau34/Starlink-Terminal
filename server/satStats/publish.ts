import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type ArchiverFactory = (format: string, options?: { zlib?: { level?: number } }) => import('archiver').Archiver;
const createArchiver = require('archiver') as ArchiverFactory;
import type Database from 'better-sqlite3';
import { CHART_FEED_KEYS } from './types.js';
import {
  SAT_STATS_EXPORTS_DIR,
  SAT_STATS_LAYER1_DIR,
  SAT_STATS_PUBLIC_DIR,
} from './config.js';
import type { LaunchArchiveRow, StarlinkScraperLogRow } from './types.js';
import { getLatestSnapshot, getSnapshot } from './snapshot.js';

const LAUNCH_ARCHIVE_CSV = 'Launch Archive.csv';
const STARLINK_SCRAPER_LOG_CSV = 'Starlink Scraper Log.csv';
const LAUNCH_VEHICLE_LOG_CSV = 'Launch Vehicle Log.csv';

const LAUNCH_FIELDS: [keyof LaunchArchiveRow, string][] = [
  ['flight_no', 'Flight No.'],
  ['date_utc', 'Date'],
  ['vehicle', 'Vehicle'],
  ['booster', 'Booster'],
  ['ship', 'Ship'],
  ['launch_site', 'Launch site'],
  ['payload_type', 'Payload Type'],
  ['payload', 'Payload'],
  ['payload_mass_kg', 'Payload mass kg'],
  ['orbit', 'Orbit'],
  ['customer', 'Customer'],
  ['launch_outcome', 'Launch outcome'],
  ['booster_landing', 'Booster landing'],
  ['number_of_starlink_satellites', 'Number of Starlink Satellites'],
  ['starlink_model', 'Starlink Model'],
  ['of_which_dtc', 'Of Which DTC'],
  ['description', 'Description'],
];

const STARLINK_FIELDS: [keyof StarlinkScraperLogRow, string][] = [
  ['snapshot_date', 'Date'],
  ['total_sats_launched', 'Total Sats Launched'],
  ['disposal_complete', 'Disposal Complete'],
  ['total_down', 'Total Down'],
  ['total_in_orbit', 'Total In Orbit'],
  ['total_working', 'Total Working'],
  ['gbps_per_sat', 'Gbps/Sat'],
  ['total_bandwidth_in_orbit_tbps', 'Total Bandwidth in Orbit (Tbps)'],
  ['active_v1', 'Active V1'],
  ['active_v15', 'Active V1.5'],
  ['active_v2_mini', 'Active V2 Mini'],
  ['active_v2_mini_d2c', 'Active V2 Mini D2C'],
  ['active_v2_mini_opt', 'Active V2 Mini Opt'],
  ['down_v1', 'Down V1'],
  ['down_v15', 'Down V1.5'],
  ['down_v2_mini', 'Down V2 Mini'],
  ['down_v2_mini_d2c', 'Down V2 Mini D2C'],
  ['down_v2_mini_opt', 'Down V2 Mini Opt'],
];

function escapeCsv(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  pairs: [keyof T, string][]
): string {
  const header = pairs.map(([, label]) => escapeCsv(label)).join(',');
  const lines = rows.map((row) =>
    pairs.map(([key]) => escapeCsv(row[key as string])).join(',')
  );
  return [header, ...lines].join('\n');
}

function buildLaunchVehicleRows(launches: LaunchArchiveRow[]): Record<string, unknown>[] {
  const perBooster = new Map<string, LaunchArchiveRow[]>();
  for (const row of launches) {
    const booster = (row.booster ?? '').trim();
    if (!booster) continue;
    const list = perBooster.get(booster) ?? [];
    list.push(row);
    perBooster.set(booster, list);
  }
  const out: Record<string, unknown>[] = [];
  for (const [booster, rows] of perBooster) {
    rows.sort((a, b) => a.date_utc.localeCompare(b.date_utc));
    out.push({
      Booster: booster,
      Flights: rows.length,
      'First flight': rows[0]?.date_utc ?? '',
      'Last flight': rows.at(-1)?.date_utc ?? '',
      Vehicle: rows[0]?.vehicle ?? '',
    });
  }
  out.sort((a, b) => String(a.Booster).localeCompare(String(b.Booster)));
  return out;
}

export function exportLayer1RawCsvs(conn: Database.Database): {
  output_dir: string;
  files: string[];
  launch_archive_rows: number;
  starlink_scraper_log_rows: number;
  launch_vehicle_log_rows: number;
} {
  fs.mkdirSync(SAT_STATS_LAYER1_DIR, { recursive: true });
  const launches = conn
    .prepare('SELECT * FROM launch_archive ORDER BY date_utc, flight_no')
    .all() as LaunchArchiveRow[];
  const starlink = conn
    .prepare('SELECT * FROM starlink_scraper_log ORDER BY snapshot_date')
    .all() as StarlinkScraperLogRow[];

  const launchPath = path.join(SAT_STATS_LAYER1_DIR, LAUNCH_ARCHIVE_CSV);
  const starPath = path.join(SAT_STATS_LAYER1_DIR, STARLINK_SCRAPER_LOG_CSV);
  const lvPath = path.join(SAT_STATS_LAYER1_DIR, LAUNCH_VEHICLE_LOG_CSV);

  const launchCsv = rowsToCsv(launches as unknown as Record<string, unknown>[], LAUNCH_FIELDS);
  const starCsv = rowsToCsv(starlink as unknown as Record<string, unknown>[], STARLINK_FIELDS);
  const lvRows = buildLaunchVehicleRows(launches);
  const lvHeaders = ['Booster', 'Flights', 'First flight', 'Last flight', 'Vehicle'] as const;
  const lvCsv = [
    lvHeaders.join(','),
    ...lvRows.map((r) => lvHeaders.map((h) => escapeCsv(r[h])).join(',')),
  ].join('\n');

  fs.writeFileSync(launchPath, launchCsv, 'utf8');
  fs.writeFileSync(starPath, starCsv, 'utf8');
  fs.writeFileSync(lvPath, lvCsv, 'utf8');

  return {
    output_dir: SAT_STATS_LAYER1_DIR,
    files: [launchPath, starPath, lvPath],
    launch_archive_rows: launches.length,
    starlink_scraper_log_rows: starlink.length,
    launch_vehicle_log_rows: lvRows.length,
  };
}

export function exportChartFeeds(snapshotId: number, conn: Database.Database): string[] {
  const snap = getSnapshot(conn, snapshotId);
  if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);
  fs.mkdirSync(SAT_STATS_EXPORTS_DIR, { recursive: true });
  const written: string[] = [];
  for (const key of CHART_FEED_KEYS) {
    const rows = snap.feeds[key] ?? [];
    const file = path.join(SAT_STATS_EXPORTS_DIR, `${key}.csv`);
    if (!rows.length) {
      fs.writeFileSync(file, 'month_end\n', 'utf8');
    } else {
      const headers = Object.keys(rows[0]!);
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
      ].join('\n');
      fs.writeFileSync(file, csv, 'utf8');
    }
    written.push(file);
  }
  return written;
}

function renderFactPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Sat Stats</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #f4f4f4; }
    .meta { color: #555; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
  <p class="meta">Generated by Starlink-Terminal Sat Stats. Source data archived locally; not republished verbatim.</p>
</body>
</html>`;
}

export function publishStaticFactPages(conn: Database.Database, snapshotId?: number): string[] {
  const snap = snapshotId ? getSnapshot(conn, snapshotId) : getLatestSnapshot(conn);
  if (!snap) return [];
  fs.mkdirSync(SAT_STATS_PUBLIC_DIR, { recursive: true });
  const written: string[] = [];
  const dash = snap.dashboard;
  const indexHtml = renderFactPage(
    'Starlink fleet snapshot',
    `<p class="meta">Snapshot #${snap.snapshot_id} · ${snap.created_at}</p>
    <table>
      <tr><th>Active satellites</th><td>${dash.active_satellites ?? 0}</td></tr>
      <tr><th>Deorbited</th><td>${dash.deorbited_satellites ?? 0}</td></tr>
      <tr><th>Constellation bandwidth (Tbps)</th><td>${dash.constellation_bw_tbps ?? 0}</td></tr>
      <tr><th>Est. customers</th><td>${dash.est_customers ?? 0}</td></tr>
      <tr><th>Total launches (all-time rollup)</th><td>${dash.total_launches_all_time ?? 0}</td></tr>
    </table>`
  );
  const indexPath = path.join(SAT_STATS_PUBLIC_DIR, 'index.html');
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  written.push(indexPath);

  const feedsDir = path.join(SAT_STATS_PUBLIC_DIR, 'feeds');
  fs.mkdirSync(feedsDir, { recursive: true });
  for (const key of CHART_FEED_KEYS) {
    const rows = snap.feeds[key] ?? [];
    const headers = rows[0] ? Object.keys(rows[0]) : ['month_end'];
    const tableRows = rows
      .slice(-24)
      .map(
        (r) =>
          `<tr>${headers.map((h) => `<td>${escapeCsv(r[h])}</td>`).join('')}</tr>`
      )
      .join('');
    const html = renderFactPage(
      key.replace(/_/g, ' '),
      `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>`
    );
    const p = path.join(feedsDir, `${key}.html`);
    fs.writeFileSync(p, html, 'utf8');
    written.push(p);
  }
  return written;
}

export function publishSnapshot(
  conn: Database.Database,
  snapshotId: number,
  actor: string,
  mode: string
): Record<string, unknown> {
  const layer1 = exportLayer1RawCsvs(conn);
  const chartFiles = exportChartFeeds(snapshotId, conn);
  const staticPages = publishStaticFactPages(conn, snapshotId);
  const diff = { layer1, chart_files: chartFiles, static_pages: staticPages };
  conn
    .prepare(
      `INSERT INTO publish_log(snapshot_id, mode, actor, payload_diff_json, status, details)
       VALUES (?,?,?,?,?,?)`
    )
    .run(snapshotId, mode, actor, JSON.stringify(diff), 'published', null);
  return diff;
}

export async function buildChartFeedsZip(conn: Database.Database, snapshotId: number): Promise<Buffer> {
  const files = exportChartFeeds(snapshotId, conn);
  const layer1 = exportLayer1RawCsvs(conn);
  const allFiles = [...files, ...layer1.files];
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = createArchiver('zip', { zlib: { level: 9 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const filePath of allFiles) {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: path.basename(filePath) });
      }
    }
    void archive.finalize();
  });
}
