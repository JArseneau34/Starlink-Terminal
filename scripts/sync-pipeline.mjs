/**
 * Build-time sync: Space-Industry-Data-Pipeline exports → static TS data modules.
 * Run: npm run sync:pipeline
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pipelineRoot = join(root, 'Space-Industry-Data-Pipeline');
const exportsDir = join(pipelineRoot, 'exports');
const layer1LaunchCsv = join(pipelineRoot, 'layer1_raw', 'Launch Archive.csv');
const fleetOut = join(root, 'src', 'data', 'starlinkFleetSnapshot.ts');
const launchOut = join(root, 'src', 'data', 'starlinkLaunchArchive.ts');
const bandwidthOut = join(root, 'src', 'data', 'starlinkBandwidthSeries.ts');
const growthOut = join(root, 'src', 'data', 'starlinkFleetGrowthSeries.ts');

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    let value = '';
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += text[i++];
        }
      }
      if (text[i] === ',') i++;
    } else {
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        value += text[i++];
      }
      if (text[i] === ',') i++;
    }
    return value;
  }

  while (i < len) {
    if (text[i] === '\r') {
      i++;
      continue;
    }
    if (text[i] === '\n') {
      i++;
      if (rows.length === 0) continue;
      break;
    }
    const row = [];
    while (i < len && text[i] !== '\n' && text[i] !== '\r') {
      row.push(readField());
    }
    if (row.some((cell) => cell.length > 0)) rows.push(row);
    if (text[i] === '\r') i++;
    if (text[i] === '\n') i++;
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });
}

function readCsv(name) {
  const path = join(exportsDir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing pipeline export: ${path}`);
  }
  return parseCsv(readFileSync(path, 'utf8'));
}

function latestByMonth(rows, key = 'month_end') {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]))).at(-1);
}

function toInt(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function toFloat(value) {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateUtc(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
    return epoch.toISOString().slice(0, 10);
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : text;
}

function writeBandwidthSeries(rows) {
  const series = [...rows]
    .sort((a, b) => String(a.month_end).localeCompare(String(b.month_end)))
    .map((row) => ({
      monthEnd: String(row.month_end),
      totalBandwidthTbps: toFloat(row.total_bandwidth_tbps),
      customersImputed: toInt(row.customers_imputed),
    }));

  const content = `/**
 * Monthly constellation bandwidth + subscriber imputations — static export from Space-Industry-Data-Pipeline.
 * Source: exports/bandwidth_vs_customers.csv (${series.length} rows).
 * Regenerate: npm run sync:pipeline
 */

export interface StarlinkBandwidthMonth {
  monthEnd: string;
  totalBandwidthTbps: number;
  customersImputed: number;
}

export const STARLINK_BANDWIDTH_SERIES: StarlinkBandwidthMonth[] = ${JSON.stringify(series, null, 2)};
`;
  writeFileSync(bandwidthOut, content);
  console.log(`Wrote bandwidth series (${series.length} rows) → ${bandwidthOut}`);
}

function writeFleetGrowthSeries(activeRows, bwRows) {
  const bwByMonth = new Map(bwRows.map((row) => [String(row.month_end), row]));
  const series = [...activeRows]
    .sort((a, b) => String(a.month_end).localeCompare(String(b.month_end)))
    .map((row) => {
      const month = String(row.month_end);
      const bw = bwByMonth.get(month);
      return {
        monthEnd: month,
        activeSatellites: toInt(row.active_satellites),
        deorbitedSatellites: toInt(row.deorbited_satellites),
        totalBandwidthTbps: bw ? toFloat(bw.total_bandwidth_tbps) : 0,
      };
    })
    // Keep only the era with a working fleet — earlier months are all zeros.
    .filter((row) => row.activeSatellites > 0);

  const content = `/**
 * Monthly working-fleet growth — static export from Space-Industry-Data-Pipeline.
 * Joins exports/active_vs_deorbited_sats.csv with exports/bandwidth_vs_customers.csv on month_end
 * (${series.length} rows with a non-zero working fleet).
 * Regenerate: npm run sync:pipeline
 */

export interface StarlinkFleetGrowthMonth {
  monthEnd: string;
  activeSatellites: number;
  deorbitedSatellites: number;
  totalBandwidthTbps: number;
}

export const STARLINK_FLEET_GROWTH_SERIES: StarlinkFleetGrowthMonth[] = ${JSON.stringify(series, null, 2)};
`;
  writeFileSync(growthOut, content);
  console.log(`Wrote fleet growth series (${series.length} rows) → ${growthOut}`);
}

function writeFleetSnapshot(activeRow, modelRow, bwRow) {
  const snapshotDate = activeRow.month_end;
  const content = `/**
 * McDowell fleet snapshot — static export from Space-Industry-Data-Pipeline.
 * Sources: exports/active_vs_deorbited_sats.csv, exports/sat_model_segmentation.csv,
 * exports/bandwidth_vs_customers.csv (latest month_end row: ${snapshotDate}).
 * Regenerate: npm run sync:pipeline
 */

export interface StarlinkFleetModelCounts {
  v1: number;
  v15: number;
  v2Mini: number;
  v2MiniD2c: number;
  v2MiniOpt: number;
}

export interface StarlinkFleetSnapshot {
  snapshotDate: string;
  totalWorking: number;
  totalDown: number;
  models: StarlinkFleetModelCounts;
  totalBandwidthInOrbitTbps: number;
}

export const STARLINK_FLEET_SNAPSHOT: StarlinkFleetSnapshot = {
  snapshotDate: '${snapshotDate}',
  totalWorking: ${toInt(activeRow.active_satellites)},
  totalDown: ${toInt(activeRow.deorbited_satellites)},
  models: {
    v1: ${toInt(modelRow.v1)},
    v15: ${toInt(modelRow.v15)},
    v2Mini: ${toInt(modelRow.v2_mini)},
    v2MiniD2c: ${toInt(modelRow.v2_mini_d2c)},
    v2MiniOpt: ${toInt(modelRow.v2_mini_opt)},
  },
  totalBandwidthInOrbitTbps: ${toFloat(bwRow.total_bandwidth_tbps)},
};
`;
  writeFileSync(fleetOut, content);
  console.log(`Wrote fleet snapshot (${snapshotDate}) → ${fleetOut}`);
}

function parseLaunchArchiveCsv(text) {
  const rows = parseCsv(text);
  const launches = [];
  for (const row of rows) {
    const flightNo = String(row['Flight No.'] ?? '').trim();
    const starlinkCount = toInt(row['Number of Starlink Satellites']);
    if (!flightNo || starlinkCount <= 0) continue;
    const modelRaw = String(row['Starlink Model'] ?? '').trim();
    launches.push({
      flightNo,
      dateUtc: normalizeDateUtc(row['Date']),
      payload: String(row['Payload'] ?? '').trim() || null,
      numberOfStarlinkSatellites: starlinkCount,
      starlinkModel: modelRaw ? modelRaw.toLowerCase() : null,
      ofWhichDtc: toInt(row['Of Which DTC']),
      launchSite: String(row['Launch site'] ?? '').trim() || null,
    });
  }
  launches.sort((a, b) => b.dateUtc.localeCompare(a.dateUtc) || b.flightNo.localeCompare(a.flightNo));
  return launches;
}

function writeLaunchArchive(launches, sourceLabel) {
  const content = `/**
 * Starlink launch archive — static export from Space-Industry-Data-Pipeline.
 * Source: ${sourceLabel}
 * Regenerate: npm run sync:pipeline
 */
export interface StarlinkLaunchArchiveEntry {
  flightNo: string;
  dateUtc: string;
  payload: string | null;
  numberOfStarlinkSatellites: number;
  starlinkModel: string | null;
  ofWhichDtc: number;
  launchSite: string | null;
}

export const STARLINK_LAUNCH_ARCHIVE: StarlinkLaunchArchiveEntry[] = ${JSON.stringify(launches, null, 2)};
`;
  writeFileSync(launchOut, content);
  console.log(`Wrote ${launches.length} launch archive entries → ${launchOut}`);
}

function syncLaunchArchive() {
  if (existsSync(layer1LaunchCsv)) {
    const text = readFileSync(layer1LaunchCsv, 'utf8').trim();
    const dataRows = text.split(/\r?\n/).filter((line, idx) => idx > 0 && line.trim());
    if (dataRows.length > 0) {
      const launches = parseLaunchArchiveCsv(text);
      writeLaunchArchive(launches, 'layer1_raw/Launch Archive.csv');
      return;
    }
  }

  console.log('Layer1 Launch Archive.csv empty — falling back to Mach33 workbook extraction');
  execSync('node scripts/extract-launch-archive.mjs', { cwd: root, stdio: 'inherit' });
  execSync('node scripts/gen-launch-archive-ts.mjs', { cwd: root, stdio: 'inherit' });
}

// ── Fleet snapshot from pipeline chart feeds ─────────────────────────────────
const activeRows = readCsv('active_vs_deorbited_sats.csv');
const modelRows = readCsv('sat_model_segmentation.csv');
const bwRows = readCsv('bandwidth_vs_customers.csv');

const activeRow = latestByMonth(activeRows);
const modelRow = latestByMonth(modelRows);
const bwRow = latestByMonth(bwRows);

if (!activeRow || !modelRow || !bwRow) {
  throw new Error('Pipeline export CSVs have no data rows.');
}

writeFleetSnapshot(activeRow, modelRow, bwRow);
writeBandwidthSeries(bwRows);
writeFleetGrowthSeries(activeRows, bwRows);
syncLaunchArchive();

console.log('Pipeline sync complete.');
