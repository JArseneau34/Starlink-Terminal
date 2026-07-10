import type Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import { GLOBAL_LAUNCH_COLUMNS, GLOBAL_SATELLITE_COLUMNS, loadAllGlobalLaunches, loadAllGlobalSatellites } from './repository.js';

const require = createRequire(import.meta.url);
type ArchiverFactory = (format: string, options?: { zlib?: { level?: number } }) => import('archiver').Archiver;
const createArchiver = require('archiver') as ArchiverFactory;

const LAUNCH_CSV_HEADERS = [
  'Launch Tag',
  'Date',
  'Date (raw)',
  'Launch Vehicle',
  'Variant',
  'Agency',
  'Launch Site',
  'Launch Pad',
  'Mission',
  'Flight',
  'Flight Code',
  'Category',
  'Group',
  'Launch Code',
  'Fail Code',
  'Apogee (km)',
  'Range (km)',
  'Destination',
  'Orbital Payloads',
  'Notes',
];

const SAT_CSV_HEADERS = [
  'JCAT',
  'NORAD ID',
  'Launch Tag',
  'Piece',
  'Object Type',
  'Name',
  'Payload Name',
  'Launch Date',
  'Decay Date',
  'Status',
  'Owner',
  'State',
  'Manufacturer',
  'Bus',
  'Mass (kg)',
  'Dry Mass (kg)',
  'Total Mass (kg)',
  'Length (m)',
  'Diameter (m)',
  'Span (m)',
  'Perigee (km)',
  'Apogee (km)',
  'Inclination (deg)',
  'Operating Orbit',
  'Alternate Names',
];

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return `${lines.join('\n')}\n`;
}

function launchRowToCsv(row: Record<string, unknown>): unknown[] {
  return [
    row.launch_tag,
    row.launch_date_iso,
    row.launch_date,
    row.lv_type,
    row.variant,
    row.agency,
    row.launch_site,
    row.launch_pad,
    row.mission,
    row.flight,
    row.flight_code,
    row.category,
    row.launch_group,
    row.launch_code,
    row.fail_code,
    row.apogee_km,
    row.range_km,
    row.dest,
    row.orb_pay,
    row.notes,
  ];
}

function satelliteRowToCsv(row: Record<string, unknown>): unknown[] {
  return [
    row.jcat,
    row.satcat,
    row.launch_tag,
    row.piece,
    row.object_type,
    row.name,
    row.pl_name,
    row.l_date_iso ?? row.l_date,
    row.d_date_iso ?? row.d_date,
    row.status,
    row.owner,
    row.state,
    row.manufacturer,
    row.bus,
    row.mass_kg,
    row.dry_mass_kg,
    row.tot_mass_kg,
    row.length_m,
    row.diameter_m,
    row.span_m,
    row.perigee_km,
    row.apogee_km,
    row.inc_deg,
    row.op_orbit,
    row.alt_names,
  ];
}

export async function buildGlobalCsvZip(conn: Database.Database): Promise<Buffer> {
  const launches = loadAllGlobalLaunches(conn);
  const satellites = loadAllGlobalSatellites(conn);

  if (!launches.length && !satellites.length) {
    throw new Error('No global catalog data to export');
  }

  const launchCsv = toCsv(
    LAUNCH_CSV_HEADERS,
    launches.map((row) => launchRowToCsv(row))
  );
  const satCsv = toCsv(
    SAT_CSV_HEADERS,
    satellites.map((row) => satelliteRowToCsv(row))
  );

  const archive = createArchiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(stream);
  archive.append(launchCsv, { name: 'Global Launches.csv' });
  archive.append(satCsv, { name: 'Global Satellites.csv' });
  void archive.finalize();
  return done;
}

/** Column lists exported for tests / tooling. */
export const EXPORT_COLUMNS = {
  launches: GLOBAL_LAUNCH_COLUMNS,
  satellites: GLOBAL_SATELLITE_COLUMNS,
};
