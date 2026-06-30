import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const launches = JSON.parse(readFileSync(join(root, 'scripts/launch-archive-export.json'), 'utf8'));

const header = `/**
 * Starlink launch archive — static export from Mach33 workbook (Launch Archive sheet).
 * Source: Space-Industry-Data-Pipeline/SpaceX Database (Mach33).xlsx
 * Regenerate: node scripts/extract-launch-archive.mjs && node scripts/gen-launch-archive-ts.mjs
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

export const STARLINK_LAUNCH_ARCHIVE: StarlinkLaunchArchiveEntry[] = `;

writeFileSync(join(root, 'src/data/starlinkLaunchArchive.ts'), `${header}${JSON.stringify(launches, null, 2)};\n`);
console.log(`Wrote ${launches.length} entries to src/data/starlinkLaunchArchive.ts`);
