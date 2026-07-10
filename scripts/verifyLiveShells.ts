/**
 * Live catalog shell verification harness.
 *
 * Fetches live TLE/OMM records, dumps counts by inclination / altitude / lifecycle,
 * maps them to the 9 mission image categories, and optionally compares against
 * scripts/fixtures/live-shell-reference.json.
 *
 * Usage:
 *   npm run verify:live-shells
 *   LIVE_SHELLS_STRICT=1 npm run verify:live-shells
 *   npm run verify:live-shells -- --record   # snapshot observed counts into fixture
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyStarlinkLifecycleFromOmm,
  meanAltitudeKmFromOmm,
  type StarlinkLifecycle,
} from '../src/data/starlinkOrbitOmm.ts';
import { VISUAL_SHELL_SPECS, classifyVisualShell } from '../src/data/starlinkVisualShells.ts';
import {
  assertShellCountInvariant,
  resolveStarlinkCatalog,
  shellsFromBucketed,
} from '../server/services/starlinkCatalogFetch.ts';
import {
  GENERATION_MIX_REFERENCE,
  IMAGE_NORAD_TOTAL,
  MCDOWELL_WORKING_TOTAL,
  resolveNoradReferenceTotal,
} from '../src/data/starlinkLiveShellReference.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'live-shell-reference.json');

const INCLINATION_TARGETS = [33.0, 43.0, 53.0, 53.2, 70.0, 97.4, 97.6] as const;
const INCLINATION_TOL_DEG = 0.6;

const ALTITUDE_BINS: { label: string; min: number; max: number }[] = [
  { label: '<300 km (decay)', min: -Infinity, max: 300 },
  { label: '300–450 km (transfer)', min: 300, max: 450 },
  { label: '450–520 km (low)', min: 450, max: 520 },
  { label: '520–560 km (mid 53°)', min: 520, max: 560 },
  { label: '560–600 km (polar/SSO)', min: 560, max: 600 },
  { label: '600+ km', min: 600, max: Infinity },
];

interface CountRef {
  count: number | null;
  tolerancePct?: number;
  maxCount?: number;
  source?: string;
}

interface LiveShellReference {
  description: string;
  recordedAt: string | null;
  source: string;
  totalTracked: number;
  totalTolerancePct: number;
  totalSource?: string;
  imageNoradTotal?: number;
  imageTaxonomy?: string;
  mcdowellWorking?: number;
  generationMix?: Record<string, number>;
  categories: Record<string, CountRef>;
  inclinationBins?: Record<string, CountRef>;
  notes?: string;
}

interface HarnessFailure {
  check: string;
  context: string;
  detail: string;
}

function fail(failures: HarnessFailure[], check: string, context: string, detail: string): void {
  failures.push({ check, context, detail });
}

function loadFixture(): LiveShellReference {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as LiveShellReference;
}

function saveFixture(fixture: LiveShellReference): void {
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
}

function nearestInclinationBin(inc: number): string {
  let best = 'other';
  let bestDiff = Infinity;
  for (const target of INCLINATION_TARGETS) {
    const diff = Math.abs(inc - target);
    if (diff < bestDiff && diff <= INCLINATION_TOL_DEG) {
      bestDiff = diff;
      best = target.toFixed(1);
    }
  }
  return best;
}

function altitudeBinLabel(altKm: number): string {
  for (const bin of ALTITUDE_BINS) {
    if (altKm >= bin.min && altKm < bin.max) return bin.label;
  }
  return 'unknown';
}

function pctDelta(observed: number, expected: number): number {
  if (expected === 0) return observed === 0 ? 0 : 100;
  return (Math.abs(observed - expected) / expected) * 100;
}

function withinTolerance(
  observed: number,
  ref: CountRef,
  defaultTolPct: number
): { ok: boolean; detail: string } {
  if (ref.maxCount != null && observed > ref.maxCount) {
    return { ok: false, detail: `observed ${observed} > max ${ref.maxCount}` };
  }
  if (ref.count == null) {
    return { ok: true, detail: 'no reference count (report only)' };
  }
  const tol = ref.tolerancePct ?? defaultTolPct;
  const delta = pctDelta(observed, ref.count);
  if (delta > tol) {
    return {
      ok: false,
      detail: `observed ${observed} vs ref ${ref.count} (Δ ${delta.toFixed(1)}% > ${tol}% tol)`,
    };
  }
  return { ok: true, detail: `observed ${observed} vs ref ${ref.count} (Δ ${delta.toFixed(1)}%)` };
}

function printBar(label: string, count: number, total: number, width = 28): void {
  const pct = total > 0 ? count / total : 0;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
  console.log(
    `  ${label.padEnd(22)} ${String(count).padStart(6)}  ${bar} ${(pct * 100).toFixed(1)}%`
  );
}

function compareCounts(
  failures: HarnessFailure[],
  strict: boolean,
  label: string,
  observed: Record<string, number>,
  refs: Record<string, CountRef>,
  defaultTolPct: number
): void {
  console.log(`\nCompare → ${label}`);
  console.log('  ' + 'category'.padEnd(22) + 'observed  reference  status');
  console.log('  ' + '-'.repeat(62));

  for (const [name, ref] of Object.entries(refs)) {
    const count = observed[name] ?? 0;
    const { ok, detail } = withinTolerance(count, ref, defaultTolPct);
    const refStr = ref.count == null ? '—' : String(ref.count);
    const status = ok ? 'OK' : 'DRIFT';
    console.log(`  ${name.padEnd(22)} ${String(count).padStart(6)}  ${refStr.padStart(9)}  ${status}  ${detail}`);
    if (!ok && strict) {
      fail(failures, 'reference-drift', `${label}/${name}`, detail);
    }
  }
}

async function main(): Promise<void> {
  const record = process.argv.includes('--record');
  const strict = process.env.LIVE_SHELLS_STRICT === '1';
  const failures: HarnessFailure[] = [];

  console.log('Live catalog shell verification');
  console.log(`  fixture: ${FIXTURE_PATH}`);
  console.log(`  strict: ${strict ? 'yes' : 'no (set LIVE_SHELLS_STRICT=1 to fail on drift)'}`);
  console.log('');

  const catalog = await resolveStarlinkCatalog({ forceRefresh: !record });
  const bucketed = catalog.sats;
  const shells = shellsFromBucketed(bucketed);

  try {
    assertShellCountInvariant({ count: catalog.count, shells });
  } catch (err) {
    fail(
      failures,
      'shell-invariant',
      'catalog',
      err instanceof Error ? err.message : String(err)
    );
  }

  console.log('Catalog ingest');
  console.log(`  source:     ${catalog.source}${catalog.offline ? ' (stale cache)' : ''}`);
  console.log(`  count:      ${catalog.count.toLocaleString()}`);
  console.log(`  fetchedAt:  ${new Date(catalog.fetchedAt).toISOString()}`);
  const noradReference = resolveNoradReferenceTotal(catalog.count);
  console.log(
    `  McDowell:   ${MCDOWELL_WORKING_TOTAL.toLocaleString()} working (primary fleet target)`
  );
  console.log(
    `  NORAD ref:  ${noradReference.toLocaleString()} (${catalog.count > 0 ? 'live catalog' : 'static fallback'})`
  );
  console.log(`  Δ vs McDowell: ${(catalog.count - MCDOWELL_WORKING_TOTAL).toLocaleString()}`);
  console.log(`  Δ vs NORAD ref: ${(catalog.count - noradReference).toLocaleString()}`);

  const inclinationBins = new Map<string, number>();
  const altitudeBins = new Map<string, number>();
  const lifecycleCounts: Record<StarlinkLifecycle, number> = {
    operational: 0,
    raising: 0,
    deorbiting: 0,
    other: 0,
  };
  const categoryCounts: Record<string, number> = Object.fromEntries(
    VISUAL_SHELL_SPECS.map((s) => [s.name, 0])
  );
  const categoryLifecycle = new Map<string, Record<StarlinkLifecycle, number>>();

  for (const spec of VISUAL_SHELL_SPECS) {
    categoryLifecycle.set(spec.name, {
      operational: 0,
      raising: 0,
      deorbiting: 0,
      other: 0,
    });
  }

  const incLifecycle = new Map<string, Record<StarlinkLifecycle, number>>();

  for (const row of bucketed) {
    const omm = row.omm;
    const incBin = nearestInclinationBin(omm.INCLINATION);
    inclinationBins.set(incBin, (inclinationBins.get(incBin) ?? 0) + 1);

    const altKm = meanAltitudeKmFromOmm(omm);
    const altBin = altitudeBinLabel(altKm);
    altitudeBins.set(altBin, (altitudeBins.get(altBin) ?? 0) + 1);

    const lifecycle = classifyStarlinkLifecycleFromOmm(omm);
    lifecycleCounts[lifecycle]++;

    const shellName = classifyVisualShell(omm).shellName;
    categoryCounts[shellName] = (categoryCounts[shellName] ?? 0) + 1;
    categoryLifecycle.get(shellName)![lifecycle]++;

    const incKey = incBin;
    const incLife = incLifecycle.get(incKey) ?? {
      operational: 0,
      raising: 0,
      deorbiting: 0,
      other: 0,
    };
    incLife[lifecycle]++;
    incLifecycle.set(incKey, incLife);
  }

  const total = catalog.count;

  console.log('\n── Inclination bins (nearest FCC shell) ──');
  const incSorted = [...inclinationBins.entries()].sort((a, b) => {
    if (a[0] === 'other') return 1;
    if (b[0] === 'other') return -1;
    return Number(a[0]) - Number(b[0]);
  });
  for (const [bin, count] of incSorted) {
    printBar(`${bin}°`, count, total);
  }

  console.log('\n── Mean altitude bins ──');
  for (const bin of ALTITUDE_BINS) {
    const count = altitudeBins.get(bin.label) ?? 0;
    printBar(bin.label, count, total);
  }

  console.log('\n── Lifecycle (from OMM perigee/apogee/ecc) ──');
  for (const key of ['operational', 'raising', 'deorbiting', 'other'] as const) {
    printBar(key, lifecycleCounts[key], total);
  }

  console.log('\n── Mission categories (image taxonomy) ──');
  console.log('  ' + 'category'.padEnd(22) + 'count   ops   raise  deorb  other');
  console.log('  ' + '-'.repeat(58));
  for (const spec of VISUAL_SHELL_SPECS) {
    const life = categoryLifecycle.get(spec.name)!;
    const count = categoryCounts[spec.name] ?? 0;
    console.log(
      `  ${spec.name.padEnd(22)} ${String(count).padStart(5)}  ` +
        `${String(life.operational).padStart(5)}  ${String(life.raising).padStart(5)}  ` +
        `${String(life.deorbiting).padStart(5)}  ${String(life.other).padStart(5)}`
    );
  }

  console.log('\n── Inclination × lifecycle ──');
  for (const [inc, life] of [...incLifecycle.entries()].sort((a, b) => {
    if (a[0] === 'other') return 1;
    if (b[0] === 'other') return -1;
    return Number(a[0]) - Number(b[0]);
  })) {
    const sum = life.operational + life.raising + life.deorbiting + life.other;
    console.log(
      `  ${inc.padEnd(8)} n=${String(sum).padStart(5)}  ` +
        `ops=${life.operational}  raise=${life.raising}  deorb=${life.deorbiting}  other=${life.other}`
    );
  }

  console.log('\n── Catalog shells (API payload) ──');
  console.log(`  ${shells.map((sh) => `${sh.name}=${sh.count}`).join(', ')}`);

  const fixture = loadFixture();

  if (record) {
    const updated: LiveShellReference = {
      ...fixture,
      recordedAt: new Date().toISOString(),
      source: catalog.source,
      // Keep McDowell as authoritative total; store observed live count in notes.
      totalTracked: fixture.mcdowellWorking ?? MCDOWELL_WORKING_TOTAL,
      totalSource: 'mcdowell-working',
      imageNoradTotal: fixture.imageNoradTotal ?? IMAGE_NORAD_TOTAL,
      notes:
        `Last live ingest: ${catalog.count.toLocaleString()} from ${catalog.source} at ${new Date(catalog.fetchedAt).toISOString()}. ` +
        (fixture.notes ?? ''),
      categories: Object.fromEntries(
        VISUAL_SHELL_SPECS.map((spec) => [
          spec.name,
          {
            count: categoryCounts[spec.name] ?? 0,
            tolerancePct: fixture.categories[spec.name]?.tolerancePct ?? 15,
            source: fixture.categories[spec.name]?.source ?? 'live-record',
            ...(spec.name === 'Other' ? { maxCount: 50 } : {}),
          },
        ])
      ),
      inclinationBins: Object.fromEntries(
        INCLINATION_TARGETS.map((inc) => {
          const key = inc.toFixed(1);
          return [
            key,
            {
              count: inclinationBins.get(key) ?? 0,
              tolerancePct: fixture.inclinationBins?.[key]?.tolerancePct ?? 15,
              source: fixture.inclinationBins?.[key]?.source ?? 'live-record',
            },
          ];
        })
      ),
    };
    saveFixture(updated);
    console.log(`\nRecorded observed category/inclination counts → ${FIXTURE_PATH}`);
    console.log(`  (totalTracked kept at McDowell ${updated.totalTracked.toLocaleString()}; live ingest was ${catalog.count.toLocaleString()})`);
    process.exit(0);
  }

  const mcdowellRef = fixture.mcdowellWorking ?? MCDOWELL_WORKING_TOTAL;
  const totalTol = fixture.totalTolerancePct;
  const mcdowellDelta = pctDelta(catalog.count, mcdowellRef);
  const imageTotal = fixture.imageNoradTotal ?? IMAGE_NORAD_TOTAL;

  console.log('\n── Fleet total (McDowell primary) ──');
  console.log(
    `  live ingest:  ${catalog.count.toLocaleString()} ` +
      `vs McDowell working ${mcdowellRef.toLocaleString()} ` +
      `(Δ ${mcdowellDelta.toFixed(1)}%, tol ${totalTol}%)`
  );
  console.log(
    `  image NORAD:  ${imageTotal.toLocaleString()} (reference image; includes raising/decay TLEs)`
  );
  console.log(`  Δ live−McDowell: ${(catalog.count - mcdowellRef).toLocaleString()}`);
  console.log(`  Δ live−image:    ${(catalog.count - imageTotal).toLocaleString()}`);

  if (mcdowellDelta > totalTol && strict) {
    fail(
      failures,
      'reference-total',
      'mcdowellWorking',
      `observed ${catalog.count} vs McDowell ${mcdowellRef} (Δ ${mcdowellDelta.toFixed(1)}% > ${totalTol}%)`
    );
  }

  const gen1Observed =
    (categoryCounts['Gen1-I'] ?? 0) +
    (categoryCounts['Gen1-II'] ?? 0) +
    (categoryCounts['Gen1-Transit'] ?? 0);
  const gen2Observed =
    (categoryCounts.Gen2 ?? 0) + (categoryCounts['Gen2-Transit'] ?? 0);

  console.log('\n── Generation mix (McDowell hardware vs image buckets) ──');
  console.log(
    `  Gen1 family:  ${gen1Observed.toLocaleString()} observed vs McDowell ${GENERATION_MIX_REFERENCE.gen1Hardware.toLocaleString()} ` +
      `(v1=${GENERATION_MIX_REFERENCE.v1}, v15=${GENERATION_MIX_REFERENCE.v15})`
  );
  console.log(
    `  Gen2 family:  ${gen2Observed.toLocaleString()} observed vs McDowell ${GENERATION_MIX_REFERENCE.gen2Hardware.toLocaleString()} ` +
      `(v2 mini=${GENERATION_MIX_REFERENCE.v2Mini}, d2c=${GENERATION_MIX_REFERENCE.v2MiniD2c}, opt=${GENERATION_MIX_REFERENCE.v2MiniOpt})`
  );
  console.log(`  Gen1-I only:  ${(categoryCounts['Gen1-I'] ?? 0).toLocaleString()} vs McDowell v1 ${GENERATION_MIX_REFERENCE.v1}`);

  if (strict) {
    const gen1Delta = pctDelta(gen1Observed, GENERATION_MIX_REFERENCE.gen1Hardware);
    if (gen1Delta > 20) {
      fail(
        failures,
        'generation-mix',
        'gen1-family',
        `observed ${gen1Observed} vs McDowell gen1 ${GENERATION_MIX_REFERENCE.gen1Hardware} (Δ ${gen1Delta.toFixed(1)}%)`
      );
    }
    const gen2Delta = pctDelta(gen2Observed, GENERATION_MIX_REFERENCE.gen2Hardware);
    if (gen2Delta > 15) {
      fail(
        failures,
        'generation-mix',
        'gen2-family',
        `observed ${gen2Observed} vs McDowell gen2 ${GENERATION_MIX_REFERENCE.gen2Hardware} (Δ ${gen2Delta.toFixed(1)}%)`
      );
    }
    const gen1iDelta = pctDelta(categoryCounts['Gen1-I'] ?? 0, GENERATION_MIX_REFERENCE.v1);
    if (gen1iDelta > 25) {
      fail(
        failures,
        'generation-mix',
        'Gen1-I',
        `observed ${categoryCounts['Gen1-I'] ?? 0} vs McDowell v1 ${GENERATION_MIX_REFERENCE.v1} (Δ ${gen1iDelta.toFixed(1)}%)`
      );
    }
  }

  compareCounts(
    failures,
    strict,
    'mission categories (image taxonomy, McDowell targets)',
    categoryCounts,
    fixture.categories,
    15
  );

  if (fixture.inclinationBins) {
    const incObserved: Record<string, number> = {};
    for (const target of INCLINATION_TARGETS) {
      incObserved[target.toFixed(1)] = inclinationBins.get(target.toFixed(1)) ?? 0;
    }
    compareCounts(failures, strict, 'inclination bins', incObserved, fixture.inclinationBins, 15);
  }

  const otherCount = categoryCounts.Other ?? 0;
  const otherRef = fixture.categories.Other;
  if (otherRef?.maxCount != null && otherCount > otherRef.maxCount && strict) {
    fail(
      failures,
      'unclassified',
      'Other',
      `${otherCount} satellites unclassified (max ${otherRef.maxCount})`
    );
  }

  console.log('');
  if (failures.length === 0) {
    console.log('PASS — live shell catalog dumps complete.');
    if (!strict) {
      console.log('  (category drift is report-only unless LIVE_SHELLS_STRICT=1; use --record to snapshot live proportions)');
    }
    process.exit(0);
  }

  console.log(`FAIL — ${failures.length} verification issue(s):`);
  for (const f of failures) {
    console.log(`  [${f.check}] ${f.context} — ${f.detail}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
