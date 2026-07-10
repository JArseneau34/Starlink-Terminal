import * as cheerio from 'cheerio';
import type { LaunchArchiveRow } from '../types.js';
import { stableHash } from '../hash.js';

const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/List_of_Falcon_9_and_Falcon_Heavy_launches';
const WIKIPEDIA_STARSHIP_URL = 'https://en.wikipedia.org/wiki/List_of_Starship_launches';
const HISTORICAL_URLS = [
  'https://en.wikipedia.org/wiki/List_of_Falcon_9_and_Falcon_Heavy_launches_(2010%E2%80%932019)',
  'https://en.wikipedia.org/wiki/List_of_Falcon_9_and_Falcon_Heavy_launches_(2020%E2%80%932022)',
  'https://en.wikipedia.org/wiki/List_of_Falcon_9_and_Falcon_Heavy_launches_(2023)',
  WIKIPEDIA_STARSHIP_URL,
];

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/‑/g, '-').replace(/\s+/g, ' ').trim();
}

function parseDateFromText(text: string): string | null {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1]!;
  const patterns = [
    /([A-Z][a-z]{2,12}\s+\d{1,2},\s+\d{4})/,
    /(\d{1,2}\s+[A-Z][a-z]{2,12}\s+\d{4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const d = new Date(m[1]!);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function inferVehicle(text: string): string {
  const pt = text.toLowerCase();
  if (pt.includes('starship') || pt.includes('super heavy') || /\bift[- ]?\d/.test(pt)) return 'Starship';
  if (pt.includes('falcon heavy') || /\bfh\b/.test(pt)) return 'Falcon Heavy';
  const cores = new Set(text.match(/\bB10\d{2}\b/gi) ?? []);
  if (cores.size >= 2 || pt.includes('heavy')) return 'Falcon Heavy';
  return 'Falcon 9';
}

function inferPayloadType(payload: string, vehicle: string): string {
  const pt = payload.toLowerCase();
  if (vehicle === 'Starship') return 'Test';
  if (pt.includes('starlink')) return 'Starlink';
  if (pt.includes('crew dragon') || /\bcrew[- ]?\d/.test(pt)) return 'Dragon Crew';
  if (pt.includes('cargo dragon') || /\bcrs[- ]?\d/.test(pt)) return 'Dragon Cargo';
  return 'Customer';
}

function parseStarlinkModel(payload: string, description: string): string | null {
  const blob = `${payload} ${description}`.toLowerCase();
  if (blob.includes('v2 mini')) return 'v2 mini';
  if (blob.includes('v1.5')) return 'v1.5';
  if (/\bv1\b/.test(blob)) return 'v1';
  if (blob.includes('v0.9')) return 'v0.9';
  return null;
}

function parseStarlinkCount(payload: string, description: string): number {
  const blob = `${payload} ${description}`;
  const m =
    blob.match(/\blaunch of\s+(\d{1,3})\s+starlink/i) ??
    blob.match(/\b(\d{1,3})\s+starlink[^.]*satellites?\b/i) ??
    payload.match(/\((\d{1,3})\s+satellites?\)/i);
  return m ? Number.parseInt(m[1]!, 10) : 0;
}

function normalizeFlightNo(raw: string, vehicle: string, prefix: string): string {
  const s = raw.trim();
  if (prefix) {
    const num = s.match(/\d+/);
    return `${prefix}${num?.[0] ?? s}`;
  }
  if (/^\d+$/.test(s)) return vehicle === 'Falcon Heavy' ? `FH ${s}` : `F9 ${s}`;
  return s;
}

function findCol(headers: string[], ...needles: string[]): number | null {
  const idx = headers.findIndex((h) => needles.every((n) => h.includes(n)));
  return idx >= 0 ? idx : null;
}

export function parseWikipediaLaunchesHtml(
  html: string,
  opts: { flightNoPrefix?: string; defaultVehicle?: string } = {}
): LaunchArchiveRow[] {
  const $ = cheerio.load(html);
  const records: LaunchArchiveRow[] = [];
  let flightCounter = 0;
  const prefix = opts.flightNoPrefix ?? '';
  const defaultVehicle = opts.defaultVehicle;

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => $(th).text().toLowerCase().trim())
      .get();
    if (!headers.some((h) => h.includes('date'))) return;

    const flightCol = findCol(headers, 'flight') ?? 0;
    const dateCol = findCol(headers, 'date') ?? 1;
    const payloadCol = findCol(headers, 'payload');
    const siteCol = findCol(headers, 'launch', 'site');
    const outcomeCol = findCol(headers, 'outcome');
    const boosterCol = findCol(headers, 'version', 'booster');
    const rows = $(table).find('tr').toArray();

    for (let i = 1; i < rows.length; i++) {
      const cols = $(rows[i]!).find('th,td');
      if (cols.length < 3) continue;
      const textCols = cols.map((__, c) => cleanText($(c).text())).get();
      const dateText = textCols[dateCol] ?? '';
      const parsedDate = parseDateFromText(dateText || textCols.join(' '));
      if (!parsedDate) continue;

      let description = '';
      const next = rows[i + 1];
      if (next) {
        const nextCols = $(next).find('th,td');
        if (nextCols.length === 1 || Number(nextCols.first().attr('colspan') ?? 0) >= 3) {
          description = cleanText(nextCols.text());
          i++;
        }
      }

      const first = textCols[flightCol] ?? '';
      const payloadText = payloadCol != null ? textCols[payloadCol] ?? '' : textCols.join(' ');
      const boosterText = boosterCol != null ? textCols[boosterCol] ?? '' : '';
      const vehicle = defaultVehicle ?? inferVehicle(`${boosterText} ${payloadText}`);
      let flightNo: string;
      if (first && (/^\d{1,4}$/.test(first) || prefix)) {
        flightNo = normalizeFlightNo(first, vehicle, prefix);
      } else {
        flightCounter += 1;
        flightNo = `${prefix}WIKI-${parsedDate}-${flightCounter}`;
      }

      const payloadType = inferPayloadType(payloadText, vehicle);
      const model = parseStarlinkModel(payloadText, description);
      const outcomeRaw = outcomeCol != null ? textCols[outcomeCol] ?? '' : '';
      const launchOutcome = outcomeRaw.toLowerCase().includes('success')
        ? 'Success'
        : outcomeRaw.toLowerCase().includes('failure')
          ? 'Failure'
          : outcomeRaw || null;

      const row: LaunchArchiveRow = {
        flight_no: flightNo,
        date_utc: parsedDate,
        vehicle,
        booster: boosterText.match(/\bB10\d{2}(?:-\d+)?\b/i)?.[0]?.toUpperCase() ?? null,
        ship: boosterText.match(/\bS\d{1,3}\b/i)?.[0]?.toUpperCase() ?? null,
        launch_site: siteCol != null ? cleanText(textCols[siteCol] ?? '') || null : null,
        payload_type: payloadType,
        payload: payloadText || null,
        payload_mass_kg: null,
        orbit: null,
        customer: payloadType === 'Starlink' ? 'SpaceX' : null,
        launch_outcome: launchOutcome,
        booster_landing: 'No attempt',
        number_of_starlink_satellites: payloadType === 'Starlink' ? parseStarlinkCount(payloadText, description) : null,
        starlink_model: model,
        of_which_dtc: 0,
        description: description.slice(0, 500) || null,
        source_id: 'wikipedia_bootstrap',
      };
      row.source_hash = stableHash(row);
      records.push(row);
    }
  });

  return records;
}

export async function fetchWikipediaHtml(url: string): Promise<string> {
  const { satStatsFetchText } = await import('../http.js');
  const tail = url.replace('https://en.wikipedia.org/wiki/', '');
  const variants = [
    url,
    `https://en.m.wikipedia.org/wiki/${tail}`,
    `https://en.wikipedia.org/w/index.php?title=${tail}&printable=yes`,
  ];
  const errors: string[] = [];
  for (const candidate of variants) {
    try {
      return await satStatsFetchText(candidate);
    } catch (err) {
      errors.push(`${candidate}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join(' | '));
}

export async function scrapeWikipediaLaunches(): Promise<LaunchArchiveRow[]> {
  const mainHtml = await fetchWikipediaHtml(WIKIPEDIA_URL);
  const merged = new Map<string, LaunchArchiveRow>();
  for (const rec of parseWikipediaLaunchesHtml(mainHtml)) merged.set(rec.flight_no, rec);
  try {
    const stHtml = await fetchWikipediaHtml(WIKIPEDIA_STARSHIP_URL);
    for (const rec of parseWikipediaLaunchesHtml(stHtml, {
      flightNoPrefix: 'ST-',
      defaultVehicle: 'Starship',
    })) {
      merged.set(rec.flight_no, rec);
    }
  } catch {
    // optional page
  }
  return [...merged.values()];
}

export async function scrapeHistoricalWikipediaLaunches(): Promise<LaunchArchiveRow[]> {
  const merged = new Map<string, LaunchArchiveRow>();
  for (const url of HISTORICAL_URLS) {
    const html = await fetchWikipediaHtml(url);
    const opts =
      url.includes('Starship')
        ? { flightNoPrefix: 'ST-', defaultVehicle: 'Starship' }
        : {};
    for (const rec of parseWikipediaLaunchesHtml(html, opts)) merged.set(rec.flight_no, rec);
  }
  return [...merged.values()];
}

export { WIKIPEDIA_URL, HISTORICAL_URLS };
