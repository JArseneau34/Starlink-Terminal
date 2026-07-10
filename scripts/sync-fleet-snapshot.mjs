/**
 * Build-time sync: sat-stats exports/DB → static McDowell fleet TS modules.
 * Prefers .cache/sat-stats/exports; falls back to local sat-stats SQLite.
 * Run: npm run sync:fleet-snapshot
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exportsDir = join(root, '.cache', 'sat-stats', 'exports');
const fleetOut = join(root, 'src', 'data', 'starlinkFleetSnapshot.ts');
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
  if (!existsSync(path)) return null;
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

function loadFeedsFromDb() {
  const script = `
    import { getDb } from './server/satStats/db.ts';
    import { getLatestSnapshot } from './server/satStats/snapshot.ts';
    const snap = getLatestSnapshot(getDb());
    if (!snap) process.exit(2);
    console.log(JSON.stringify({
      active: snap.feeds?.active_vs_deorbited_sats ?? [],
      model: snap.feeds?.sat_model_segmentation ?? [],
      bw: snap.feeds?.bandwidth_vs_customers ?? [],
    }));
  `;
  const out = execSync(
    `node --use-system-ca ./node_modules/tsx/dist/cli.mjs -e ${JSON.stringify(script)}`,
    { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();
  return JSON.parse(out);
}

function loadFeeds() {
  const activeRows = readCsv('active_vs_deorbited_sats.csv');
  const modelRows = readCsv('sat_model_segmentation.csv');
  const bwRows = readCsv('bandwidth_vs_customers.csv');

  if (activeRows?.length && modelRows?.length && bwRows?.length) {
    return { activeRows, modelRows, bwRows, source: 'sat-stats exports' };
  }

  console.log('sat-stats exports missing — reading local SQLite snapshot');
  const db = loadFeedsFromDb();
  return {
    activeRows: db.active,
    modelRows: db.model,
    bwRows: db.bw,
    source: 'sat-stats DB',
  };
}

function writeFleetGrowthSeries(activeRows, bwRows, sourceLabel) {
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
    .filter((row) => row.activeSatellites > 0);

  const content = `/**
 * Monthly working-fleet growth — static export from sat-stats (McDowell).
 * Joins active_vs_deorbited_sats with bandwidth_vs_customers on month_end
 * (${series.length} rows with a non-zero working fleet).
 * Regenerate: npm run sync:fleet-snapshot
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

function writeFleetSnapshot(activeRow, modelRow, bwRow, sourceLabel) {
  const snapshotDate = String(activeRow.month_end);
  const content = `/**
 * McDowell fleet snapshot — static export from sat-stats.
 * Sources: active_vs_deorbited_sats, sat_model_segmentation,
 * bandwidth_vs_customers (latest month_end row: ${snapshotDate}).
 * Regenerate: npm run sync:fleet-snapshot
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
  console.log(`Wrote fleet snapshot (${snapshotDate}, source: ${sourceLabel}) → ${fleetOut}`);
}

const { activeRows, modelRows, bwRows, source } = loadFeeds();
const activeRow = latestByMonth(activeRows);
const modelRow = latestByMonth(modelRows);
const bwRow = latestByMonth(bwRows);

if (!activeRow || !modelRow || !bwRow) {
  throw new Error('sat-stats feeds have no data rows.');
}

writeFleetSnapshot(activeRow, modelRow, bwRow, source);
writeFleetGrowthSeries(activeRows, bwRows, source);
console.log('Fleet snapshot sync complete.');
