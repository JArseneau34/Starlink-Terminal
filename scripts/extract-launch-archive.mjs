/**
 * One-off extractor: Mach33 workbook Launch Archive → JSON for starlinkLaunchArchive.ts
 * Run: node scripts/extract-launch-archive.mjs
 */
import { readFileSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const xlsxPath = join(root, 'Space-Industry-Data-Pipeline', 'SpaceX Database (Mach33).xlsx');
const tmpDir = join(root, 'scripts', '.xlsx-tmp');

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

function parseCellRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return m ? { col: colToNum(m[1]), row: Number(m[2]) } : null;
}

function readSharedStrings(zf) {
  try {
    const entry = zf.getEntry('xl/sharedStrings.xml');
    if (!entry) return [];
    const xml = entry.getData().toString('utf8');
    const strings = [];
    const re = /<si>(?:<t[^>]*>([^<]*)<\/t>|<r><t[^>]*>([^<]*)<\/t><\/r>)+?<\/si>/g;
    let m;
    while ((m = re.exec(xml))) {
      const parts = [...xml.slice(m.index, m.index + 500).matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]);
      strings.push(parts.join(''));
    }
    if (strings.length === 0) {
      for (const t of xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) strings.push(t[1]);
    }
    return strings;
  } catch {
    return [];
  }
}

function cellValue(cell, shared) {
  const t = cell.type;
  const v = cell.value;
  if (t === 's') return shared[Number(v)] ?? '';
  if (t === 'inlineStr') return cell.inline ?? '';
  return v ?? '';
}

function parseSheet(zf, shared, sheetPath) {
  const entry = zf.getEntry(sheetPath);
  if (!entry) return [];
  const xml = entry.getData().toString('utf8');
  const rows = new Map();
  for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(rowMatch[1]);
    const rowXml = rowMatch[2];
    const row = {};
    for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const refM = attrs.match(/\br="([A-Z]+\d+)"/);
      if (!refM) continue;
      const ref = parseCellRef(refM[1]);
      if (!ref) continue;
      const tM = attrs.match(/\bt="([^"]+)"/);
      const type = tM?.[1];
      const vM = inner.match(/<v>([^<]*)<\/v>/);
      const isM = inner.match(/<is><t[^>]*>([^<]*)<\/t><\/is>/);
      row[ref.col] = {
        type,
        value: vM?.[1] ?? '',
        inline: isM?.[1] ?? '',
      };
    }
    rows.set(rowNum, row);
  }
  const headerRow = Math.min(...rows.keys());
  const out = [];
  for (const idx of [...rows.keys()].sort((a, b) => a - b)) {
    if (idx <= headerRow) continue;
    const row = rows.get(idx);
    const get = (col) => {
      const cell = row[col];
      return cell ? String(cellValue(cell, shared)).trim() : '';
    };
    const flightNo = get(1);
    if (!flightNo) continue;
    const dateRaw = get(2);
    let dateUtc = dateRaw;
    if (/^\d+(\.\d+)?$/.test(dateRaw)) {
      const serial = Number(dateRaw);
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
      dateUtc = epoch.toISOString().slice(0, 10);
    }
    const starlinkCount = Number.parseInt(get(14), 10) || 0;
    const model = get(15).toLowerCase() || null;
    if (starlinkCount <= 0) continue;
    out.push({
      flightNo,
      dateUtc,
      payload: get(8) || null,
      numberOfStarlinkSatellites: starlinkCount,
      starlinkModel: model,
      ofWhichDtc: Number.parseInt(get(16), 10) || 0,
      launchSite: get(6) || null,
    });
  }
  return out;
}

// xlsx is a zip — copy to .zip then extract
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
const zipCopy = join(tmpDir, 'book.zip');
const xlRoot = join(tmpDir, 'xl');
copyFileSync(xlsxPath, zipCopy);
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${xlRoot.replace(/'/g, "''")}' -Force"`,
  { stdio: 'pipe' },
);

const sharedXml = readFileSync(join(xlRoot, 'xl', 'sharedStrings.xml'), 'utf8');
const shared = [];
for (const t of sharedXml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) shared.push(t[1]);

// Find Launch Archive sheet
const wbXml = readFileSync(join(xlRoot, 'xl', 'workbook.xml'), 'utf8');
const relsXml = readFileSync(join(xlRoot, 'xl', '_rels', 'workbook.xml.rels'), 'utf8');
const sheetId = [...wbXml.matchAll(/<sheet[^>]*name="Launch Archive"[^>]*r:id="([^"]+)"/g)][0]?.[1];
const target = [...relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].find(([_, id]) => id === sheetId)?.[2];
const sheetPath = join(xlRoot, 'xl', target.replace(/^\//, '').replace(/\//g, '\\'));
const sheetXml = readFileSync(sheetPath, 'utf8');

const rows = new Map();
for (const rowMatch of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const rowNum = Number(rowMatch[1]);
  const rowXml = rowMatch[2];
  const row = {};
  for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = cellMatch[1];
    const inner = cellMatch[2];
    const refM = attrs.match(/\br="([A-Z]+\d+)"/);
    if (!refM) continue;
    const ref = parseCellRef(refM[1]);
    if (!ref) continue;
    const tM = attrs.match(/\bt="([^"]+)"/);
    const type = tM?.[1];
    const vM = inner.match(/<v>([^<]*)<\/v>/);
    const isM = inner.match(/<is><t[^>]*>([^<]*)<\/t><\/is>/);
    row[ref.col] = { type, value: vM?.[1] ?? '', inline: isM?.[1] ?? '' };
  }
  rows.set(rowNum, row);
}

const headerRow = Math.min(...rows.keys());
const launches = [];
for (const idx of [...rows.keys()].sort((a, b) => a - b)) {
  if (idx <= headerRow) continue;
  const row = rows.get(idx);
  const get = (col) => {
    const cell = row[col];
    return cell ? String(cellValue(cell, shared)).trim() : '';
  };
  const flightNo = get(1);
  if (!flightNo) continue;
  const dateRaw = get(2);
  let dateUtc = dateRaw;
  if (/^\d+(\.\d+)?$/.test(dateRaw)) {
    const serial = Number(dateRaw);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
    dateUtc = epoch.toISOString().slice(0, 10);
  }
  const starlinkCount = Number.parseInt(get(14), 10) || 0;
  if (starlinkCount <= 0) continue;
  const model = get(15).toLowerCase() || null;
  launches.push({
    flightNo,
    dateUtc,
    payload: get(8) || null,
    numberOfStarlinkSatellites: starlinkCount,
    starlinkModel: model,
    ofWhichDtc: Number.parseInt(get(16), 10) || 0,
    launchSite: get(6) || null,
  });
}

const outPath = join(root, 'scripts', 'launch-archive-export.json');
writeFileSync(outPath, JSON.stringify(launches, null, 2));
console.log(`Wrote ${launches.length} Starlink launches to ${outPath}`);
rmSync(tmpDir, { recursive: true, force: true });
