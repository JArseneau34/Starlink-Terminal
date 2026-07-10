import * as cheerio from 'cheerio';
import type { StarlinkScraperLogRow } from '../types.js';
import { stableHash } from '../hash.js';

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/‑/g, '-').replace(/\s+/g, ' ').trim();
}

function parseIntToken(value: string | undefined): number {
  if (!value) return 0;
  const m = value.match(/([0-9][0-9,]*)/);
  if (!m) return 0;
  return Number.parseInt(m[1]!.replace(/,/g, ''), 10) || 0;
}

function parseLastUpdatedDate(text: string): string | null {
  const m = text.match(/Data last updated:\s*([0-9]{4}\s+[A-Za-z]{3}\s+[0-9]{1,2})/i);
  if (!m) return null;
  const d = new Date(`${m[1]!.replace(/\s+/g, ' ')} UTC`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function splitWithRatio(total: number, firstRatio: number): [number, number] {
  const first = Math.max(0, Math.min(total, Math.round(total * firstRatio)));
  return [first, total - first];
}

function extractTableStats(html: string): Record<string, number> {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  let targetTable: ReturnType<typeof $> | null = null;
  for (const table of tables) {
    const header = $(table)
      .find('th')
      .map((__, th) => $(th).text().toLowerCase())
      .get()
      .join(' ');
    if (header.includes('mission') && header.includes('total sats launched') && header.includes('total working')) {
      targetTable = $(table);
      break;
    }
  }
  if (!targetTable) return {};

  let totalRow: string[] | null = null;
  let gen1Row: string[] | null = null;
  const v2MiniRows: string[][] = [];
  const v2DtcRows: string[][] = [];
  const v2OptRows: string[][] = [];

  targetTable.find('tr').each((_, tr) => {
    const cells = $(tr)
      .find('td,th')
      .map((__, td) => cleanText($(td).text()))
      .get();
    if (!cells.length) return;
    const label = cells[0]!.toLowerCase();
    if (label === 'total') totalRow = cells;
    else if (label === 'starlink gen1' && cells.length > 11 && parseIntToken(cells[1]) > 0) gen1Row = cells;
    else if (label.includes('starlink v2 mini dtc')) v2DtcRows.push(cells);
    else if (label.includes('starlink v2 mini/opt')) v2OptRows.push(cells);
    else if (label.includes('starlink v2 mini')) v2MiniRows.push(cells);
  });

  if (!totalRow) return {};
  const col = (row: string[], idx: number) => (idx < row.length ? parseIntToken(row[idx]) : 0);

  return {
    total_launched: col(totalRow, 1),
    disposal_complete: col(totalRow, 4),
    total_down: col(totalRow, 6),
    total_in_orbit: col(totalRow, 7),
    total_working: col(totalRow, 11),
    gen1_down: gen1Row ? col(gen1Row, 6) : 0,
    gen1_working: gen1Row ? col(gen1Row, 11) : 0,
    active_v2_mini: v2MiniRows.reduce((s, r) => s + col(r, 11), 0),
    active_v2_mini_d2c: v2DtcRows.reduce((s, r) => s + col(r, 11), 0),
    active_v2_mini_opt: v2OptRows.reduce((s, r) => s + col(r, 11), 0),
    down_v2_mini: v2MiniRows.reduce((s, r) => s + col(r, 6), 0),
    down_v2_mini_d2c: v2DtcRows.reduce((s, r) => s + col(r, 6), 0),
    down_v2_mini_opt: v2OptRows.reduce((s, r) => s + col(r, 6), 0),
  };
}

function extractFallbackStats(text: string): Partial<StarlinkScraperLogRow> {
  const blob = text.toLowerCase();
  const findInt = (keyword: string) => {
    const m = blob.match(new RegExp(`${keyword}[^0-9]*([0-9][0-9,]*)`, 'i'));
    return m ? Number.parseInt(m[1]!.replace(/,/g, ''), 10) : 0;
  };
  return {
    total_sats_launched: findInt('total.*launched'),
    total_working: findInt('total working'),
    total_down: findInt('total down'),
    total_in_orbit: findInt('total in orbit'),
    disposal_complete: findInt('disposal'),
    total_bandwidth_in_orbit_tbps: 0,
  };
}

export function parseMcdowellSnapshotHtml(
  html: string,
  splitHint?: { active_v1_ratio?: number; down_v1_ratio?: number }
): StarlinkScraperLogRow {
  const stats = extractTableStats(html);
  const today = new Date().toISOString().slice(0, 10);

  if (!Object.keys(stats).length) {
    const fb = extractFallbackStats(html);
    const row: StarlinkScraperLogRow = {
      snapshot_date: parseLastUpdatedDate(html) ?? today,
      total_sats_launched: fb.total_sats_launched ?? 0,
      disposal_complete: fb.disposal_complete ?? 0,
      total_down: fb.total_down ?? 0,
      total_in_orbit: fb.total_in_orbit ?? 0,
      total_working: fb.total_working ?? 0,
      gbps_per_sat: null,
      total_bandwidth_in_orbit_tbps: fb.total_bandwidth_in_orbit_tbps ?? 0,
      active_v1: 0,
      active_v15: 0,
      active_v2_mini: 0,
      active_v2_mini_d2c: 0,
      active_v2_mini_opt: 0,
      down_v1: 0,
      down_v15: 0,
      down_v2_mini: 0,
      down_v2_mini_d2c: 0,
      down_v2_mini_opt: 0,
      source_id: 'mcdowell',
    };
    row.source_hash = stableHash(row);
    return row;
  }

  const activeV1Ratio = splitHint?.active_v1_ratio ?? 0.227;
  const downV1Ratio = splitHint?.down_v1_ratio ?? 0.717;
  const [activeV1, activeV15] = splitWithRatio(stats.gen1_working ?? 0, activeV1Ratio);
  const [downV1, downV15] = splitWithRatio(stats.gen1_down ?? 0, downV1Ratio);
  const totalBwGbps =
    activeV1 * 12 +
    activeV15 * 24 +
    (stats.active_v2_mini ?? 0) * 96 +
    (stats.active_v2_mini_d2c ?? 0) * 0 +
    (stats.active_v2_mini_opt ?? 0) * 96;
  const totalBwTbps = Math.round((totalBwGbps / 1000) * 1000) / 1000;
  const totalWorking = stats.total_working ?? 0;

  const row: StarlinkScraperLogRow = {
    snapshot_date: parseLastUpdatedDate(html) ?? today,
    total_sats_launched: stats.total_launched ?? 0,
    disposal_complete: stats.disposal_complete ?? 0,
    total_down: stats.total_down ?? 0,
    total_in_orbit: stats.total_in_orbit ?? 0,
    total_working: totalWorking,
    gbps_per_sat: totalWorking ? Math.round((totalBwGbps / totalWorking) * 1_000_000) / 1_000_000 : null,
    total_bandwidth_in_orbit_tbps: totalBwTbps,
    active_v1: activeV1,
    active_v15: activeV15,
    active_v2_mini: stats.active_v2_mini ?? 0,
    active_v2_mini_d2c: stats.active_v2_mini_d2c ?? 0,
    active_v2_mini_opt: stats.active_v2_mini_opt ?? 0,
    down_v1: downV1,
    down_v15: downV15,
    down_v2_mini: stats.down_v2_mini ?? 0,
    down_v2_mini_d2c: stats.down_v2_mini_d2c ?? 0,
    down_v2_mini_opt: stats.down_v2_mini_opt ?? 0,
    source_id: 'mcdowell',
  };
  row.source_hash = stableHash(row);
  return row;
}
