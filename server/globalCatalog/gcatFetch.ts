import fs from 'node:fs';
import path from 'node:path';
import {
  GCAT_FETCH_TIMEOUT_MS,
  GCAT_LANDING_DIR,
  GCAT_LAUNCH_URL,
  GCAT_SATCAT_URL,
  GLOBAL_CATALOG_USER_AGENT,
  MIN_LAUNCH_BYTES,
  MIN_LAUNCH_ROWS,
  MIN_SATCAT_BYTES,
  MIN_SATCAT_ROWS,
} from './config.js';

export class GcatIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GcatIngestError';
  }
}

function countDataRows(text: string): number {
  let count = 0;
  let seenHeader = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      if (!seenHeader && line.slice(1).trim()) seenHeader = true;
      continue;
    }
    if (seenHeader) count++;
  }
  return count;
}

function validateHeader(text: string, markers: string[], label: string): void {
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('#')) continue;
    const header = line.slice(1);
    const missing = markers.filter((m) => !header.includes(m));
    if (missing.length) {
      throw new GcatIngestError(
        `${label} header missing ${missing.join(', ')} — refusing non-GCAT payload`
      );
    }
    return;
  }
  throw new GcatIngestError(`${label} has no header row`);
}

export function validateLaunchTsv(text: string): void {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes < MIN_LAUNCH_BYTES) {
    throw new GcatIngestError(`launch.tsv too small (${bytes} < ${MIN_LAUNCH_BYTES} bytes)`);
  }
  validateHeader(text, ['Launch_Tag', 'Launch_Date'], 'launch.tsv');
  const rows = countDataRows(text);
  if (rows < MIN_LAUNCH_ROWS) {
    throw new GcatIngestError(`launch.tsv row count ${rows} < ${MIN_LAUNCH_ROWS}`);
  }
}

export function validateSatcatTsv(text: string): void {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes < MIN_SATCAT_BYTES) {
    throw new GcatIngestError(`satcat.tsv too small (${bytes} < ${MIN_SATCAT_BYTES} bytes)`);
  }
  validateHeader(text, ['JCAT', 'Satcat', 'Type'], 'satcat.tsv');
  const rows = countDataRows(text);
  if (rows < MIN_SATCAT_ROWS) {
    throw new GcatIngestError(`satcat.tsv row count ${rows} < ${MIN_SATCAT_ROWS}`);
  }
}

async function fetchUrl(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': GLOBAL_CATALOG_USER_AGENT, Accept: 'text/plain,*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new GcatIngestError(`GCAT fetch ${url} failed: HTTP ${res.status}`);
  }
  return res.text();
}

function atomicWrite(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, filePath);
}

async function ingestTsv(
  url: string,
  cacheName: string,
  validate: (text: string) => void,
  timeoutMs: number,
  label: string
): Promise<string> {
  const cachePath = path.join(GCAT_LANDING_DIR, cacheName);
  let fetchError: unknown;

  try {
    const text = await fetchUrl(url, timeoutMs);
    validate(text);
    atomicWrite(cachePath, text);
    console.log(
      `[global-catalog] ${label} fetched (${Buffer.byteLength(text, 'utf8').toLocaleString()} bytes, ${countDataRows(text).toLocaleString()} rows)`
    );
    return text;
  } catch (err) {
    fetchError = err;
    if (err instanceof GcatIngestError) throw err;
    console.warn(`[global-catalog] ${label} fetch failed:`, err instanceof Error ? err.message : err);
  }

  if (fs.existsSync(cachePath)) {
    const cached = fs.readFileSync(cachePath, 'utf8');
    validate(cached);
    console.warn(`[global-catalog] ${label} using validated landing cache at ${cachePath}`);
    return cached;
  }

  throw new GcatIngestError(
    `${label} fetch failed (${fetchError instanceof Error ? fetchError.message : fetchError}) and no validated cache at ${cachePath}`
  );
}

export async function fetchLaunchTsv(): Promise<string> {
  return ingestTsv(GCAT_LAUNCH_URL, 'launch.tsv', validateLaunchTsv, GCAT_FETCH_TIMEOUT_MS, 'launch.tsv');
}

export async function fetchSatcatTsv(): Promise<string> {
  return ingestTsv(GCAT_SATCAT_URL, 'satcat.tsv', validateSatcatTsv, GCAT_FETCH_TIMEOUT_MS * 2, 'satcat.tsv');
}
