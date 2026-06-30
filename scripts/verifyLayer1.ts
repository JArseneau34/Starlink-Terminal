/**
 * Layer 1 harness — orbital propagation invariants.
 *
 * Internal: per-satellite physical sanity via satellite.js only (no hand-rolled rotations).
 * External: 5 NORAD IDs cross-checked against n2yo at one UTC timestamp.
 *
 * Usage:
 *   npm run verify:layer1
 *   LAYER1_UTC=2026-06-29T12:00:00.000Z npm run verify:layer1
 *   N2YO_API_KEY=... npm run verify:layer1 -- --record   # snapshot n2yo reference
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SatRec } from 'satellite.js';
import { buildStarlinkCatalog, STARLINK_SHELLS } from '../src/components/starlink/starlinkCatalog.ts';
import {
  buildCatalogShells,
} from '../src/data/starlinkShellBands.ts';
import {
  assertShellCountInvariant,
  bucketOmmRecords,
} from '../server/services/starlinkCatalogFetch.ts';
import { classifyVisualShell } from '../src/data/starlinkVisualShells.ts';
import {
  buildTopologyCatalogPayload,
  satrecFromCatalogIndex,
} from '../src/utils/starlinkPropagation.ts';
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  ecfToEci,
  geodeticToEcf,
  gstime,
  json2satrec,
  propagate,
} from '../src/lib/satelliteJsCore.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'layer1-external.json');
const CELESTRAK_URLS = [
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=JSON',
  'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=JSON',
];
const CELESTRAK_HEADERS = { 'User-Agent': 'SPCX-Terminal/1.0 (layer1-harness)' };

/** Primary 53° shell altitude nominal (km) — flag if >50 km off. */
const SHELL_53_NOMINAL_ALT_KM = 550;
const SHELL_53_ALT_TOL_KM = 50;

/** 53° LEO Starlink physical bands (≈550 km; wider for 525–530 km shells). */
const PERIOD_MIN_MIN = 94.5;
const PERIOD_MIN_MAX = 96.5;
const SPEED_KMS_NOMINAL = 7.5;
const SPEED_KMS_TOL = 0.3;

const ROUNDTRIP_HEIGHT_TOL_M = 1;

/** Shell indices treated as the 53° band (topology + live assignment). */
const SHELL_53_INDICES = new Set([0, 1, 2, 3, 4]);

/** Five stable Starlink NORAD IDs for external cross-check. */
const EXTERNAL_NORAD_IDS = [44_713, 48_274, 55_084, 57_288, 59_449] as const;

interface InvariantFailure {
  check: string;
  context: string;
  detail: string;
}

interface GeodeticRadians {
  latitude: number;
  longitude: number;
  height: number;
}

interface ExternalFixture {
  recordedAt: string;
  source: string;
  observer: { lat: number; lng: number; alt: number };
  tolerance: { altKm: number; latDeg: number; lonDeg: number };
  satellites: Array<{
    noradId: number;
    name?: string;
    latitude: number;
    longitude: number;
    sataltitude: number;
  }>;
}

interface OmmRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  INCLINATION: number;
  ECCENTRICITY?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  ELEMENT_SET_NO?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
  OBJECT_ID?: string;
}

function fail(
  failures: InvariantFailure[],
  check: string,
  context: string,
  detail: string
): void {
  failures.push({ check, context, detail });
}

function periodMinutesFromMeanMotion(meanMotionRevPerDay: number): number {
  return 1440 / meanMotionRevPerDay;
}

function temeSpeedKms(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function geodeticHeightRoundTripErrorM(geodetic: GeodeticRadians, when: Date): number {
  const gmst = gstime(when);
  const ecf = geodeticToEcf(geodetic);
  const eci = ecfToEci(ecf, gmst);
  const recovered = eciToGeodetic(eci, gmst);
  return Math.abs(recovered.height - geodetic.height) * 1000;
}

function propagateGeodetic(satrec: SatRec, when: Date): GeodeticRadians | null {
  const pv = propagate(satrec, when);
  if (!pv?.position) return null;
  const gmst = gstime(when);
  return eciToGeodetic(pv.position, gmst);
}

function checkSatelliteInvariants(
  failures: InvariantFailure[],
  context: string,
  when: Date,
  satrec: SatRec,
  opts: {
    shellIndex?: number;
    meanMotionRevPerDay?: number;
    check53Band?: boolean;
  }
): void {
  const pv = propagate(satrec, when);
  if (!pv?.position) {
    fail(failures, 'propagation', context, 'SGP4 returned no position');
    return;
  }

  const gmst = gstime(when);
  const geodetic = eciToGeodetic(pv.position, gmst);
  const altKm = geodetic.height;
  const latDeg = degreesLat(geodetic.latitude);
  const lonDeg = degreesLong(geodetic.longitude);

  if (altKm < 0) {
    fail(
      failures,
      'above-earth',
      context,
      `altitude ${altKm.toFixed(3)} km — node inside Earth`
    );
  }

  const roundTripErrM = geodeticHeightRoundTripErrorM(geodetic, when);
  if (roundTripErrM > ROUNDTRIP_HEIGHT_TOL_M) {
    fail(
      failures,
      'geodetic-roundtrip',
      context,
      `geodetic→ECEF→geodetic height error ${roundTripErrM.toFixed(3)} m (limit ${ROUNDTRIP_HEIGHT_TOL_M} m)`
    );
  }

  const check53 =
    opts.check53Band ??
    (opts.shellIndex != null && SHELL_53_INDICES.has(opts.shellIndex));

  if (check53) {
    const altDelta = Math.abs(altKm - SHELL_53_NOMINAL_ALT_KM);
    if (altDelta > SHELL_53_ALT_TOL_KM) {
      fail(
        failures,
        'altitude-53shell',
        context,
        `altitude ${altKm.toFixed(1)} km is ${altDelta.toFixed(1)} km off nominal ${SHELL_53_NOMINAL_ALT_KM} km (limit ±${SHELL_53_ALT_TOL_KM} km) @ ${latDeg.toFixed(2)}°, ${lonDeg.toFixed(2)}°`
      );
    }

    const meanMotion = opts.meanMotionRevPerDay;
    if (meanMotion != null) {
      const periodMin = periodMinutesFromMeanMotion(meanMotion);
      if (periodMin < PERIOD_MIN_MIN || periodMin > PERIOD_MIN_MAX) {
        fail(
          failures,
          'period-53shell',
          context,
          `orbital period ${periodMin.toFixed(2)} min outside [${PERIOD_MIN_MIN}, ${PERIOD_MIN_MAX}] min`
        );
      }
    }

    if (pv.velocity) {
      const speed = temeSpeedKms(pv.velocity);
      if (Math.abs(speed - SPEED_KMS_NOMINAL) > SPEED_KMS_TOL) {
        fail(
          failures,
          'speed-53shell',
          context,
          `TEME speed ${speed.toFixed(3)} km/s outside ${SPEED_KMS_NOMINAL}±${SPEED_KMS_TOL} km/s`
        );
      }
    }
  }
}

function runTopologyInvariants(when: Date): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const { satellites } = buildStarlinkCatalog();
  const catalog = buildTopologyCatalogPayload(satellites);
  const satrecs = Array.from({ length: catalog.count }, (_, i) =>
    satrecFromCatalogIndex(catalog, i)
  );

  let checked53 = 0;
  for (let i = 0; i < catalog.count; i++) {
    const satrec = satrecs[i];
    if (!satrec) {
      fail(failures, 'satrec', `topology[${i}]`, 'failed to build satrec from OMM');
      continue;
    }
    const shell = satellites[i]!.shell;
    const is53 = SHELL_53_INDICES.has(shell);
    if (is53) checked53++;

    checkSatelliteInvariants(failures, `topology[${i}] shell=${STARLINK_SHELLS[shell]!.name}`, when, satrec, {
      shellIndex: shell,
      meanMotionRevPerDay: catalog.ommMeanMotion?.[i],
      check53Band: is53,
    });
  }

  console.log(
    `  topology: ${catalog.count.toLocaleString()} satellites checked (${checked53.toLocaleString()} in 53° band)`
  );
  return failures;
}

async function fetchCelebrakCatalog(): Promise<Map<number, { satrec: SatRec; omm: OmmRecord }>> {
  let lastError: unknown = null;
  let rows: OmmRecord[] | null = null;

  for (const url of CELESTRAK_URLS) {
    try {
      const res = await fetch(url, {
        headers: CELESTRAK_HEADERS,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 403) {
        lastError = new Error(`CelesTrak fetch returned 403 for ${url}`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`CelesTrak fetch failed: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as OmmRecord[];
      if (!Array.isArray(data) || data.length === 0) {
        lastError = new Error(`CelesTrak returned empty catalog for ${url}`);
        continue;
      }
      rows = data;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!rows) {
    throw lastError instanceof Error ? lastError : new Error('CelesTrak fetch failed');
  }

  const map = new Map<number, { satrec: SatRec; omm: OmmRecord }>();
  for (const omm of rows) {
    if (!omm.NORAD_CAT_ID || !omm.EPOCH) continue;
    try {
      const satrec = json2satrec({
        OBJECT_NAME: omm.OBJECT_NAME,
        OBJECT_ID: omm.OBJECT_ID ?? '',
        NORAD_CAT_ID: omm.NORAD_CAT_ID,
        EPOCH: omm.EPOCH,
        MEAN_MOTION: omm.MEAN_MOTION,
        ECCENTRICITY: omm.ECCENTRICITY ?? 0,
        INCLINATION: omm.INCLINATION,
        RA_OF_ASC_NODE: omm.RA_OF_ASC_NODE ?? 0,
        ARG_OF_PERICENTER: omm.ARG_OF_PERICENTER ?? 0,
        MEAN_ANOMALY: omm.MEAN_ANOMALY ?? 0,
        ELEMENT_SET_NO: omm.ELEMENT_SET_NO ?? 999,
        BSTAR: omm.BSTAR ?? 0,
        MEAN_MOTION_DOT: omm.MEAN_MOTION_DOT ?? 0,
        MEAN_MOTION_DDOT: omm.MEAN_MOTION_DDOT ?? 0,
        EPHEMERIS_TYPE: 0,
      });
      map.set(omm.NORAD_CAT_ID, { satrec, omm });
    } catch {
      // skip malformed elements
    }
  }
  return map;
}

function checkLiveShellCountInvariant(
  catalog: Map<number, { satrec: SatRec; omm: OmmRecord }>,
  failures: InvariantFailure[]
): void {
  const bucketed = bucketOmmRecords([...catalog.values()].map((row) => row.omm));
  const shells = buildCatalogShells(bucketed.map((sat) => sat.shell));
  try {
    assertShellCountInvariant({ count: bucketed.length, shells });
    console.log(
      `  live shell buckets: ${shells.map((sh) => `${sh.name}=${sh.count}`).join(', ')}`
    );
  } catch (err) {
    fail(
      failures,
      'live-shell-counts',
      'catalog',
      err instanceof Error ? err.message : String(err)
    );
  }
}

async function runLiveSampleInvariants(when: Date, sampleSize = 120): Promise<InvariantFailure[]> {
  const failures: InvariantFailure[] = [];
  const catalog = await fetchCelebrakCatalog();
  const ids = [...catalog.keys()];
  if (ids.length === 0) {
    fail(failures, 'live-catalog', 'celestrak', 'empty Starlink catalog');
    return failures;
  }

  checkLiveShellCountInvariant(catalog, failures);
  const stride = Math.max(1, Math.floor(ids.length / sampleSize));
  let checked = 0;
  for (let i = 0; i < ids.length && checked < sampleSize; i += stride) {
    const noradId = ids[i]!;
    const row = catalog.get(noradId);
    if (!row) continue;
    const shell = classifyVisualShell(row.omm).shellIndex;
    checkSatelliteInvariants(
      failures,
      `live NORAD ${noradId} inc=${row.omm.INCLINATION.toFixed(1)}°`,
      when,
      row.satrec,
      {
        shellIndex: shell,
        meanMotionRevPerDay: row.omm.MEAN_MOTION,
        check53Band: SHELL_53_INDICES.has(shell),
      }
    );
    checked++;
  }

  console.log(`  live TLE sample: ${checked} satellites checked (stride ${stride})`);
  return failures;
}

interface N2yoPosition {
  noradId: number;
  name?: string;
  latitude: number;
  longitude: number;
  sataltitude: number;
}

async function fetchN2yoPosition(
  noradId: number,
  apiKey: string,
  observer: { lat: number; lng: number; alt: number }
): Promise<N2yoPosition | null> {
  const url =
    `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}` +
    `/${observer.lat}/${observer.lng}/${observer.alt}/1` +
    `?apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new Error(`n2yo HTTP ${res.status} for NORAD ${noradId}`);
  }
  const body = (await res.json()) as {
    info?: { satname?: string };
    positions?: Array<{
      satlatitude: string;
      satlongitude: string;
      sataltitude: string;
    }>;
  };
  const pos = body.positions?.[0];
  if (!pos) return null;
  return {
    noradId,
    name: body.info?.satname,
    latitude: Number(pos.satlatitude),
    longitude: Number(pos.satlongitude),
    sataltitude: Number(pos.sataltitude),
  };
}

function loadFixture(): ExternalFixture | null {
  try {
    const raw = readFileSync(FIXTURE_PATH, 'utf8');
    const fixture = JSON.parse(raw) as ExternalFixture;
    if (!fixture.satellites?.length) return null;
    return fixture;
  } catch {
    return null;
  }
}

function saveFixture(fixture: ExternalFixture): void {
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
}

function lonDeltaDeg(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

async function runExternalCrossCheck(
  when: Date,
  catalog: Map<number, { satrec: SatRec; omm: OmmRecord }>,
  opts: { record: boolean }
): Promise<InvariantFailure[]> {
  const failures: InvariantFailure[] = [];
  const apiKey = process.env.N2YO_API_KEY?.trim();
  const fixture = loadFixture();
  const observer = fixture?.observer ?? { lat: 0, lng: 0, alt: 0 };
  const tolerance = fixture?.tolerance ?? { altKm: 5, latDeg: 0.15, lonDeg: 0.15 };

  let references: N2yoPosition[] = [];
  let referenceUtc = when.toISOString();

  if (opts.record && apiKey) {
    console.log('  recording n2yo reference positions…');
    for (const noradId of EXTERNAL_NORAD_IDS) {
      const pos = await fetchN2yoPosition(noradId, apiKey, observer);
      if (pos) references.push(pos);
    }
    const recorded: ExternalFixture = {
      recordedAt: referenceUtc,
      source: 'n2yo',
      observer,
      tolerance,
      satellites: references,
    };
    saveFixture(recorded);
    console.log(`  wrote ${references.length} references → ${FIXTURE_PATH}`);
  } else if (apiKey) {
    console.log('  fetching live n2yo positions…');
    for (const noradId of EXTERNAL_NORAD_IDS) {
      const pos = await fetchN2yoPosition(noradId, apiKey, observer);
      if (pos) references.push(pos);
    }
    referenceUtc = new Date().toISOString();
  } else if (fixture) {
    references = fixture.satellites;
    referenceUtc = fixture.recordedAt;
    console.log(`  using fixture recorded at ${referenceUtc}`);
  } else {
    console.log(
      '  SKIP external cross-check — set N2YO_API_KEY or run with --record after populating fixture'
    );
    console.log(
      '  Manual: compare at https://www.heavens-above.com/ for the same UTC epoch'
    );
    return failures;
  }

  const checkWhen = new Date(referenceUtc);
  if (Number.isNaN(checkWhen.getTime())) {
    fail(failures, 'external-utc', 'timestamp', `invalid reference UTC: ${referenceUtc}`);
    return failures;
  }

  for (const ref of references) {
    const row = catalog.get(ref.noradId);
    if (!row) {
      fail(
        failures,
        'external-catalog',
        `NORAD ${ref.noradId}`,
        'not found in CelesTrak Starlink catalog'
      );
      continue;
    }

    const geodetic = propagateGeodetic(row.satrec, checkWhen);
    if (!geodetic) {
      fail(failures, 'external-propagate', `NORAD ${ref.noradId}`, 'propagation failed');
      continue;
    }

    const ourLat = degreesLat(geodetic.latitude);
    const ourLon = degreesLong(geodetic.longitude);
    const ourAlt = geodetic.height;

    const dAlt = Math.abs(ourAlt - ref.sataltitude);
    const dLat = Math.abs(ourLat - ref.latitude);
    const dLon = lonDeltaDeg(ourLon, ref.longitude);

    const label = ref.name ?? `NORAD ${ref.noradId}`;
    if (dAlt > tolerance.altKm) {
      fail(
        failures,
        'external-altitude',
        label,
        `Δalt ${dAlt.toFixed(2)} km (ours ${ourAlt.toFixed(1)} vs n2yo ${ref.sataltitude.toFixed(1)}) @ ${referenceUtc}`
      );
    }
    if (dLat > tolerance.latDeg) {
      fail(
        failures,
        'external-latitude',
        label,
        `Δlat ${dLat.toFixed(3)}° (ours ${ourLat.toFixed(3)}° vs n2yo ${ref.latitude.toFixed(3)}°)`
      );
    }
    if (dLon > tolerance.lonDeg) {
      fail(
        failures,
        'external-longitude',
        label,
        `Δlon ${dLon.toFixed(3)}° (ours ${ourLon.toFixed(3)}° vs n2yo ${ref.longitude.toFixed(3)}°)`
      );
    }

    if (dAlt <= tolerance.altKm && dLat <= tolerance.latDeg && dLon <= tolerance.lonDeg) {
      console.log(
        `    ✓ ${label}: alt Δ${dAlt.toFixed(2)} km, lat Δ${dLat.toFixed(3)}°, lon Δ${dLon.toFixed(3)}°`
      );
    }
  }

  return failures;
}

function printFailures(failures: InvariantFailure[]): void {
  const byCheck = new Map<string, number>();
  for (const f of failures) {
    byCheck.set(f.check, (byCheck.get(f.check) ?? 0) + 1);
  }
  console.log('\nFailures by check:');
  for (const [check, count] of [...byCheck.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check}: ${count}`);
  }
  console.log('\nFirst 20 failures:');
  for (const f of failures.slice(0, 20)) {
    console.log(`  [${f.check}] ${f.context} — ${f.detail}`);
  }
  if (failures.length > 20) {
    console.log(`  … and ${failures.length - 20} more`);
  }
}

async function main(): Promise<void> {
  const record = process.argv.includes('--record');
  const utcArg = process.env.LAYER1_UTC?.trim();
  const when = utcArg ? new Date(utcArg) : new Date();
  if (Number.isNaN(when.getTime())) {
    console.error(`Invalid LAYER1_UTC: ${utcArg}`);
    process.exit(2);
  }

  console.log('Layer 1 — orbital propagation invariants');
  console.log(`  UTC epoch: ${when.toISOString()}`);
  console.log(`  53° shell: alt ${SHELL_53_NOMINAL_ALT_KM}±${SHELL_53_ALT_TOL_KM} km, period ${PERIOD_MIN_MIN}–${PERIOD_MIN_MAX} min, speed ${SPEED_KMS_NOMINAL}±${SPEED_KMS_TOL} km/s`);
  console.log(`  round-trip height tolerance: ${ROUNDTRIP_HEIGHT_TOL_M} m`);
  console.log('');

  const allFailures: InvariantFailure[] = [];

  console.log('[1/3] Topology Walker catalog (all nodes)…');
  allFailures.push(...runTopologyInvariants(when));

  console.log('[2/3] Live CelesTrak TLE sample…');
  let liveCatalog: Map<number, { satrec: SatRec; omm: OmmRecord }> | null = null;
  const strict = process.env.LAYER1_STRICT === '1';
  try {
    liveCatalog = await fetchCelebrakCatalog();
    allFailures.push(...(await runLiveSampleInvariants(when)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  WARN: live sample skipped — ${msg}`);
    if (strict) {
      fail(allFailures, 'live-catalog', 'celestrak', msg);
    }
  }

  console.log('[3/3] External n2yo / Heavens-Above cross-check (5 NORAD IDs)…');
  if (liveCatalog) {
    const externalFailures = await runExternalCrossCheck(when, liveCatalog, { record });
    allFailures.push(...externalFailures);
  } else {
    console.log('  SKIP — no CelesTrak catalog for external compare');
    if (strict) {
      fail(allFailures, 'external-catalog', 'celestrak', 'catalog required for external cross-check');
    }
  }

  console.log('');
  if (allFailures.length === 0) {
    console.log('PASS — all Layer 1 invariants satisfied.');
    process.exit(0);
  }

  console.log(`FAIL — ${allFailures.length} invariant violation(s).`);
  printFailures(allFailures);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
