/** GCAT TSV parsing — ported from global_sources.py */

export const LAUNCH_COLUMN_MAP: Record<string, string> = {
  Launch_Tag: 'launch_tag',
  Launch_JD: 'launch_jd',
  Launch_Date: 'launch_date',
  LV_Type: 'lv_type',
  Variant: 'variant',
  Flight_ID: 'flight_id',
  Flight: 'flight',
  Mission: 'mission',
  FlightCode: 'flight_code',
  Platform: 'platform',
  Launch_Site: 'launch_site',
  Launch_Pad: 'launch_pad',
  Ascent_Site: 'ascent_site',
  Ascent_Pad: 'ascent_pad',
  Apogee: 'apogee_km',
  Apoflag: 'apo_flag',
  Range: 'range_km',
  RangeFlag: 'range_flag',
  Dest: 'dest',
  OrbPay: 'orb_pay',
  Agency: 'agency',
  LaunchCode: 'launch_code',
  FailCode: 'fail_code',
  Group: 'launch_group',
  Category: 'category',
  LTCite: 'lt_cite',
  Cite: 'cite',
  Notes: 'notes',
};

export const SATCAT_COLUMN_MAP: Record<string, string> = {
  JCAT: 'jcat',
  Satcat: 'satcat',
  Launch_Tag: 'launch_tag',
  Piece: 'piece',
  Type: 'object_type',
  Name: 'name',
  PLName: 'pl_name',
  LDate: 'l_date',
  Parent: 'parent',
  SDate: 's_date',
  Primary: 'primary_body',
  DDate: 'd_date',
  Status: 'status',
  Dest: 'dest',
  Owner: 'owner',
  State: 'state',
  Manufacturer: 'manufacturer',
  Bus: 'bus',
  Motor: 'motor',
  Mass: 'mass_kg',
  MassFlag: 'mass_flag',
  DryMass: 'dry_mass_kg',
  DryFlag: 'dry_flag',
  TotMass: 'tot_mass_kg',
  TotFlag: 'tot_flag',
  Length: 'length_m',
  LFlag: 'length_flag',
  Diameter: 'diameter_m',
  DFlag: 'diameter_flag',
  Span: 'span_m',
  SpanFlag: 'span_flag',
  Shape: 'shape',
  ODate: 'o_date',
  Perigee: 'perigee_km',
  PF: 'perigee_flag',
  Apogee: 'apogee_km',
  AF: 'apogee_flag',
  Inc: 'inc_deg',
  IF: 'inc_flag',
  OpOrbit: 'op_orbit',
  OQUAL: 'oqual',
  AltNames: 'alt_names',
};

const REAL_LAUNCH_COLS = new Set(['launch_jd', 'apogee_km', 'range_km']);
const REAL_SATCAT_COLS = new Set([
  'mass_kg',
  'dry_mass_kg',
  'tot_mass_kg',
  'length_m',
  'diameter_m',
  'span_m',
  'perigee_km',
  'apogee_km',
  'inc_deg',
]);

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type GcatLaunchRow = Record<string, string | number | null>;
export type GcatSatelliteRow = Record<string, string | number | null>;

function clean(value: string | null | undefined): string {
  if (value == null) return '';
  const stripped = value.trim();
  if (stripped === '' || stripped === '-') return '';
  return stripped;
}

function parseNumber(value: string): number | null {
  const text = clean(value);
  if (!text) return null;
  const trimmed = text.replace(/\?+$/, '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseGcatDate(value: string | null | undefined): string | null {
  const text = clean(value ?? '');
  if (!text) return null;
  const normalized = text.replace(/\[/g, ' ').replace(/\]/g, ' ');
  const match = /^\s*(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const day = Number(match[3]);
  if (!month || !Number.isFinite(year) || !Number.isFinite(day)) return null;
  if (day < 1 || day > 31) return null;
  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return iso;
}

function parseHeader(line: string): string[] {
  return line
    .replace(/^#/, '')
    .split('\t')
    .map((col) => col.trim());
}

function* iterDataRows(
  text: string,
  columnMap: Record<string, string>,
  realCols: Set<string>
): Generator<Record<string, string | number | null>> {
  let header: string[] | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine;
    if (!line) continue;
    if (line.startsWith('#')) {
      if (header === null) header = parseHeader(line);
      continue;
    }
    if (!header) continue;

    let cells = line.split('\t');
    if (cells.length < header.length) {
      cells = [...cells, ...Array(header.length - cells.length).fill('')];
    } else if (cells.length > header.length) {
      cells = cells.slice(0, header.length);
    }

    const record: Record<string, string | number | null> = {};
    for (const dbCol of Object.values(columnMap)) record[dbCol] = null;

    for (const [srcCol, dbCol] of Object.entries(columnMap)) {
      const idx = header.indexOf(srcCol);
      if (idx < 0) continue;
      const rawCell = cells[idx] ?? '';
      if (realCols.has(dbCol)) {
        record[dbCol] = parseNumber(rawCell);
      } else {
        const cleaned = clean(rawCell);
        record[dbCol] = cleaned || null;
      }
    }
    yield record;
  }
}

export function parseGcatLaunchTsv(text: string): GcatLaunchRow[] {
  const out: GcatLaunchRow[] = [];
  for (const record of iterDataRows(text, LAUNCH_COLUMN_MAP, REAL_LAUNCH_COLS)) {
    if (!record.launch_tag) continue;
    record.launch_date_iso = parseGcatDate(String(record.launch_date ?? ''));
    out.push(record);
  }
  return out;
}

export function parseGcatSatcatTsv(text: string): GcatSatelliteRow[] {
  const out: GcatSatelliteRow[] = [];
  for (const record of iterDataRows(text, SATCAT_COLUMN_MAP, REAL_SATCAT_COLS)) {
    if (!record.jcat) continue;
    record.l_date_iso = parseGcatDate(String(record.l_date ?? ''));
    record.d_date_iso = parseGcatDate(String(record.d_date ?? ''));
    out.push(record);
  }
  return out;
}
