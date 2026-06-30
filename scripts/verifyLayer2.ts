/**
 * Layer 2 harness — Walker topology consistency.
 *
 * Validates ISL graph invariants when plane sizes are uneven (e.g. 108 planes /
 * 5686 sats → 70×53 + 38×52). Naive uniform sats/plane indexing breaks on the
 * remainder; this harness proves the catalog handles it correctly.
 *
 * Usage:
 *   npm run verify:layer2
 */

import {
  buildStarlinkCatalog,
  catalogIndex,
  planeSatCounts,
  shellSatCount,
  STARLINK_SHELLS,
  type StarlinkSatellite,
} from '../src/components/starlink/starlinkCatalog.ts';
import { distributeSatsAcrossPlanes, TOPOLOGY_FLEET_TARGET } from '../src/data/starlinkShells.ts';

interface TopologyFailure {
  check: string;
  context: string;
  detail: string;
}

function fail(
  failures: TopologyFailure[],
  check: string,
  context: string,
  detail: string
): void {
  failures.push({ check, context, detail });
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function planeDelta(from: number, to: number, planes: number): number {
  return (((to - from) % planes) + planes) % planes;
}

function shellBaseIndex(shell: number): number {
  let base = 0;
  for (let i = 0; i < shell; i++) {
    base += shellSatCount(STARLINK_SHELLS[i]!);
  }
  return base;
}

function planeBaseIndex(shell: number, plane: number): number {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  let base = shellBaseIndex(shell);
  const p = ((plane % sh.planes) + sh.planes) % sh.planes;
  for (let i = 0; i < p; i++) {
    base += counts[i]!;
  }
  return base;
}

function expectedRingPartner(shell: number, plane: number, slot: number): number {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const satsInPlane = counts[plane]!;
  const nextSlot = (slot + 1) % satsInPlane;
  return catalogIndex(shell, plane, nextSlot);
}

function expectedCrossPartner(shell: number, plane: number, slot: number): number | null {
  const sh = STARLINK_SHELLS[shell]!;
  if (sh.planes <= 1) return null;
  const counts = planeSatCounts(sh);
  const F = sh.walkerF ?? 1;
  const nextPlane = (plane + 1) % sh.planes;
  const nextSats = counts[nextPlane]!;
  const partnerSlot = (slot + F) % nextSats;
  return catalogIndex(shell, nextPlane, partnerSlot);
}

function buildExpectedShellEdges(shell: number): {
  ring: Set<string>;
  cross: Set<string>;
  seam: Set<string>;
} {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const ring = new Set<string>();
  const cross = new Set<string>();
  const seam = new Set<string>();
  const lastPlane = sh.planes - 1;

  for (let p = 0; p < sh.planes; p++) {
    const satsInPlane = counts[p]!;
    for (let s = 0; s < satsInPlane; s++) {
      const a = catalogIndex(shell, p, s);
      const ringB = expectedRingPartner(shell, p, s);
      ring.add(edgeKey(a, ringB));

      const crossB = expectedCrossPartner(shell, p, s);
      if (crossB != null) {
        const key = edgeKey(a, crossB);
        cross.add(key);
        if (p === lastPlane) seam.add(key);
      }
    }
  }

  return { ring, cross, seam };
}

function checkPlaneSizeDistribution(failures: TopologyFailure[], shell: number): void {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const total = shellSatCount(sh);
  const expected = distributeSatsAcrossPlanes(sh.planes, total);
  const label = `shell ${sh.name}`;

  if (counts.length !== sh.planes) {
    fail(
      failures,
      'plane-size-count',
      label,
      `planeSatCounts length ${counts.length} !== planes ${sh.planes}`
    );
    return;
  }

  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum !== total) {
    fail(failures, 'plane-size-sum', label, `plane counts sum ${sum} !== shell total ${total}`);
  }

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (max - min > 1) {
    fail(
      failures,
      'plane-size-remainder',
      label,
      `plane sizes span ${min}–${max} (off-by-more-than-one remainder)`
    );
  }

  for (let p = 0; p < sh.planes; p++) {
    if (counts[p] !== expected[p]) {
      fail(
        failures,
        'plane-size-distribution',
        `${label} plane ${p}`,
        `got ${counts[p]} sats, expected ${expected[p]} from largest-remainder split`
      );
    }
  }

  const avg = total / sh.planes;
  const floorAvg = Math.floor(avg);
  const ceilAvg = Math.ceil(avg);
  if (min !== floorAvg || max !== ceilAvg) {
    fail(
      failures,
      'plane-size-remainder',
      label,
      `plane sizes ${min}/${max} do not match floor/ceil of mean ${avg.toFixed(3)}`
    );
  }
}

function checkSatelliteIndexing(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const label = `shell ${sh.name}`;
  const base = shellBaseIndex(shell);

  const byPlane = new Map<number, StarlinkSatellite[]>();
  for (const sat of satellites) {
    if (sat.shell !== shell) continue;
    const list = byPlane.get(sat.plane) ?? [];
    list.push(sat);
    byPlane.set(sat.plane, list);
  }

  for (let p = 0; p < sh.planes; p++) {
    const expectedCount = counts[p]!;
    const rows = byPlane.get(p) ?? [];
    if (rows.length !== expectedCount) {
      fail(
        failures,
        'satellite-indexing',
        `${label} plane ${p}`,
        `${rows.length} satellites indexed, expected ${expectedCount}`
      );
      continue;
    }

    const slots = new Set(rows.map((r) => r.idx));
    for (let s = 0; s < expectedCount; s++) {
      if (!slots.has(s)) {
        fail(
          failures,
          'satellite-indexing',
          `${label} plane ${p}`,
          `missing slot ${s} (sparse idx after uneven split)`
        );
      }
    }

    for (const sat of rows) {
      const expectedIndex = planeBaseIndex(shell, p) + sat.idx;
      const catalogIdx = catalogIndex(shell, p, sat.idx);
      if (catalogIdx !== expectedIndex) {
        fail(
          failures,
          'catalog-index',
          `${label} plane ${p} slot ${sat.idx}`,
          `catalogIndex=${catalogIdx} !== planeBase+slot=${expectedIndex}`
        );
      }
      if (catalogIdx < base || catalogIdx >= base + shellSatCount(sh)) {
        fail(
          failures,
          'catalog-index',
          `${label} plane ${p} slot ${sat.idx}`,
          `catalog index ${catalogIdx} outside shell range [${base}, ${base + shellSatCount(sh)})`
        );
      }
    }
  }
}

function checkRingClosure(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const label = `shell ${sh.name}`;

  const ringAdj = new Map<number, number[]>();
  for (let i = 0; i < edgeA.length; i++) {
    if (edgeCross[i]) continue;
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    if (satellites[a]!.shell !== shell || satellites[b]!.shell !== shell) continue;
    const la = ringAdj.get(a) ?? [];
    la.push(b);
    ringAdj.set(a, la);
    const lb = ringAdj.get(b) ?? [];
    lb.push(a);
    ringAdj.set(b, lb);
  }

  for (let p = 0; p < sh.planes; p++) {
    const satsInPlane = counts[p]!;
    const planeNodes: number[] = [];
    for (let s = 0; s < satsInPlane; s++) {
      planeNodes.push(catalogIndex(shell, p, s));
    }

    const visited = new Set<number>();
    const start = planeNodes[0]!;
    let current = start;
    let prev = -1;
    for (let step = 0; step < satsInPlane; step++) {
      visited.add(current);
      const neighbors = [...new Set((ringAdj.get(current) ?? []).filter((n) => satellites[n]!.plane === p))];
      if (neighbors.length !== 2 && satsInPlane > 2) {
        fail(
          failures,
          'ring-closure',
          `${label} plane ${p} sat ${satellites[current]!.idx}`,
          `expected 2 intra-plane ring neighbors, got ${neighbors.length}`
        );
        break;
      }
      const next = neighbors.find((n) => n !== prev);
      if (next == null && satsInPlane > 1) {
        fail(
          failures,
          'ring-closure',
          `${label} plane ${p}`,
          `ring walk broke at step ${step} — last→first wrap missing`
        );
        break;
      }
      prev = current;
      current = next ?? current;
    }

    if (visited.size !== satsInPlane) {
      fail(
        failures,
        'ring-closure',
        `${label} plane ${p}`,
        `ring visits ${visited.size}/${satsInPlane} satellites — not a single closed cycle`
      );
    }

    for (let s = 0; s < satsInPlane; s++) {
      const a = catalogIndex(shell, p, s);
      const expectedB = expectedRingPartner(shell, p, s);
      const neighbors = new Set(ringAdj.get(a) ?? []);
      if (!neighbors.has(expectedB)) {
        fail(
          failures,
          'ring-closure',
          `${label} plane ${p} slot ${s}`,
          `missing ring link to slot ${(s + 1) % satsInPlane} (index ${expectedB})`
        );
      }
    }
  }
}

function checkPlaneAdjacency(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  const label = `shell ${sh.name}`;

  for (let i = 0; i < edgeA.length; i++) {
    if (!edgeCross[i]) continue;
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const satA = satellites[a]!;
    const satB = satellites[b]!;
    if (satA.shell !== shell || satB.shell !== shell) continue;

    const dp = planeDelta(satA.plane, satB.plane, sh.planes);
    if (dp !== 1 && dp !== sh.planes - 1) {
      fail(
        failures,
        'plane-adjacency',
        `${label} NORAD-index ${a}↔${b}`,
        `planes ${satA.plane}↔${satB.plane} are not ±1 adjacent (Δ=${dp})`
      );
    }
  }
}

function checkCrossPartnerWalker(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const F = sh.walkerF ?? 1;
  const label = `shell ${sh.name}`;

  for (let i = 0; i < edgeA.length; i++) {
    if (!edgeCross[i]) continue;
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const satA = satellites[a]!;
    const satB = satellites[b]!;
    if (satA.shell !== shell || satB.shell !== shell) continue;

    const dp = planeDelta(satA.plane, satB.plane, sh.planes);
    if (dp !== 1) continue;

    const from = dp === 1 ? satA : satB;
    const to = dp === 1 ? satB : satA;
    const nextPlane = (from.plane + 1) % sh.planes;
    if (to.plane !== nextPlane) continue;

    const nextSats = counts[nextPlane]!;
    const expectedSlot = (from.idx + F) % nextSats;
    if (to.idx !== expectedSlot) {
      fail(
        failures,
        'cross-partner-walker',
        `${label} plane ${from.plane} slot ${from.idx} → plane ${to.plane}`,
        `partner slot ${to.idx} !== Walker (s+F)%${nextSats} = ${expectedSlot}`
      );
    }
  }
}

function checkSeamLinks(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  if (sh.planes <= 1) return;

  const counts = planeSatCounts(sh);
  const F = sh.walkerF ?? 1;
  const label = `shell ${sh.name}`;
  const lastPlane = sh.planes - 1;
  const seamSizeDelta = Math.abs(counts[lastPlane]! - counts[0]!);
  let reportedSeamSize = false;

  for (let i = 0; i < edgeA.length; i++) {
    if (!edgeCross[i]) continue;
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const satA = satellites[a]!;
    const satB = satellites[b]!;
    if (satA.shell !== shell || satB.shell !== shell) continue;

    const planes = new Set([satA.plane, satB.plane]);
    if (!planes.has(0) || !planes.has(lastPlane)) continue;

    const from = satA.plane === lastPlane ? satA : satB.plane === lastPlane ? satB : null;
    const to = satA.plane === 0 ? satA : satB.plane === 0 ? satB : null;
    if (!from || !to) {
      fail(
        failures,
        'seam-link',
        `${label} index ${a}↔${b}`,
        `ascending/descending seam edge does not connect plane ${lastPlane} → plane 0`
      );
      continue;
    }

    const expectedSlot = (from.idx + F) % counts[0]!;
    if (to.idx !== expectedSlot) {
      fail(
        failures,
        'seam-link',
        `${label} seam plane ${lastPlane} slot ${from.idx} → plane 0`,
        `partner slot ${to.idx} !== Walker (s+F)%${counts[0]} = ${expectedSlot} — seam cannot close`
      );
    }

    if (!reportedSeamSize && seamSizeDelta > 1) {
      reportedSeamSize = true;
      fail(
        failures,
        'seam-link',
        `${label} seam`,
        `plane size jump ${counts[lastPlane]}↔${counts[0]} at RAAN wrap exceeds ±1 (Δ=${seamSizeDelta})`
      );
    }
  }
}

function checkDuplicateEdges(
  failures: TopologyFailure[],
  edgeA: number[],
  edgeB: number[]
): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < edgeA.length; i++) {
    const key = edgeKey(edgeA[i]!, edgeB[i]!);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      fail(failures, 'duplicate-edge', key, `same undirected link stored ${count} times`);
    }
  }
}

function checkExpectedEdgeSet(
  failures: TopologyFailure[],
  shell: number,
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  const sh = STARLINK_SHELLS[shell]!;
  const label = `shell ${sh.name}`;
  const expected = buildExpectedShellEdges(shell);

  const actualRing = new Set<string>();
  const actualCross = new Set<string>();

  for (let i = 0; i < edgeA.length; i++) {
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const key = edgeKey(a, b);
    if (satellites[a]!.shell !== shell || satellites[b]!.shell !== shell) continue;
    if (edgeCross[i]) actualCross.add(key);
    else actualRing.add(key);
  }

  for (const key of expected.ring) {
    if (!actualRing.has(key)) {
      fail(failures, 'missing-ring-edge', label, `expected ring edge ${key}`);
    }
  }
  for (const key of actualRing) {
    if (!expected.ring.has(key)) {
      fail(failures, 'extra-ring-edge', label, `unexpected ring edge ${key}`);
    }
  }

  for (const key of expected.cross) {
    if (!actualCross.has(key)) {
      fail(failures, 'missing-cross-edge', label, `expected cross edge ${key}`);
    }
  }
  for (const key of actualCross) {
    if (!expected.cross.has(key)) {
      fail(failures, 'extra-cross-edge', label, `unexpected cross edge ${key}`);
    }
  }

  for (const key of expected.seam) {
    if (!actualCross.has(key)) {
      fail(failures, 'missing-seam-edge', label, `expected seam edge ${key}`);
    }
  }
}

function printFailures(failures: TopologyFailure[]): void {
  const byCheck = new Map<string, number>();
  for (const f of failures) {
    byCheck.set(f.check, (byCheck.get(f.check) ?? 0) + 1);
  }
  console.log('\nFailures by check:');
  for (const [check, count] of [...byCheck.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check}: ${count}`);
  }
  console.log('\nFirst 25 failures:');
  for (const f of failures.slice(0, 25)) {
    console.log(`  [${f.check}] ${f.context} — ${f.detail}`);
  }
  if (failures.length > 25) {
    console.log(`  … and ${failures.length - 25} more`);
  }
}

function summarizeShell(shell: number): void {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const total = shellSatCount(sh);
  const groups = new Map<number, number>();
  for (const n of counts) {
    groups.set(n, (groups.get(n) ?? 0) + 1);
  }
  const parts = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([n, planes]) => `${planes}×${n}`);
  console.log(
    `  ${sh.name}: ${sh.planes} planes, ${total.toLocaleString()} sats (${parts.join(' + ')}, mean ${(total / sh.planes).toFixed(2)}/plane)`
  );
}

function checkNonphysicalCrossPlaneLinks(
  failures: TopologyFailure[],
  satellites: StarlinkSatellite[],
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[]
): void {
  for (let i = 0; i < edgeA.length; i++) {
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const satA = satellites[a]!;
    const satB = satellites[b]!;
    const cross = edgeCross[i]!;

    if (satA.shell !== satB.shell) {
      fail(
        failures,
        'nonphysical-cross-shell',
        `edge ${a}↔${b}`,
        `link crosses shells ${STARLINK_SHELLS[satA.shell]!.name} ↔ ${STARLINK_SHELLS[satB.shell]!.name}`
      );
      continue;
    }

    const sh = STARLINK_SHELLS[satA.shell]!;
    const label = `shell ${sh.name}`;

    if (cross) {
      if (satA.plane === satB.plane) {
        fail(
          failures,
          'nonphysical-cross-plane',
          `${label} index ${a}↔${b}`,
          `cross-plane ISL marked between same plane ${satA.plane} (slot ${satA.idx}↔${satB.idx})`
        );
        continue;
      }

      const dp = planeDelta(satA.plane, satB.plane, sh.planes);
      if (dp !== 1 && dp !== sh.planes - 1) {
        fail(
          failures,
          'nonphysical-cross-plane',
          `${label} index ${a}↔${b}`,
          `cross-plane link skips planes: Δ=${dp} (expected 1 or ${sh.planes - 1} seam)`
        );
      }
    } else if (satA.plane !== satB.plane) {
      fail(
        failures,
        'nonphysical-ring-plane',
        `${label} index ${a}↔${b}`,
        `intra-plane ring link connects different planes ${satA.plane}↔${satB.plane}`
      );
    }
  }
}

function summarizeCheckGroups(failures: TopologyFailure[]): void {
  const groups = [
    { name: 'ring closure', checks: ['ring-closure', 'missing-ring-edge', 'extra-ring-edge'] },
    {
      name: 'plane adjacency',
      checks: ['plane-adjacency', 'cross-partner-walker', 'missing-cross-edge', 'extra-cross-edge'],
    },
    { name: 'seam links', checks: ['seam-link', 'missing-seam-edge'] },
    {
      name: 'nonphysical cross-plane',
      checks: ['nonphysical-cross-plane', 'nonphysical-cross-shell', 'nonphysical-ring-plane'],
    },
    { name: 'indexing / planes', checks: ['plane-size-count', 'plane-size-sum', 'plane-size-remainder', 'plane-size-distribution', 'satellite-indexing', 'catalog-index'] },
    { name: 'graph hygiene', checks: ['duplicate-edge'] },
  ];

  console.log('\nCheck groups:');
  for (const group of groups) {
    const count = failures.filter((f) => group.checks.includes(f.check)).length;
    const status = count === 0 ? 'PASS' : `FAIL (${count})`;
    console.log(`  ${group.name.padEnd(28)} ${status}`);
  }
}

function main(): void {
  console.log('Layer 2 — Walker topology verification (synthetic model)');
  console.log(`  fleet target: ${TOPOLOGY_FLEET_TARGET.toLocaleString()} satellites (McDowell snapshot)`);
  console.log('  checks: ring closure · plane adjacency · seam links · nonphysical cross-plane');
  console.log('');

  const { satellites, edgeA, edgeB, edgeCross } = buildStarlinkCatalog();
  const failures: TopologyFailure[] = [];

  console.log('Shell plane distributions:');
  for (let si = 0; si < STARLINK_SHELLS.length; si++) {
    summarizeShell(si);
  }
  console.log('');

  checkDuplicateEdges(failures, edgeA, edgeB);
  checkNonphysicalCrossPlaneLinks(failures, satellites, edgeA, edgeB, edgeCross);

  for (let si = 0; si < STARLINK_SHELLS.length; si++) {
    const sh = STARLINK_SHELLS[si]!;
    console.log(`Checking shell ${sh.name}…`);
    checkPlaneSizeDistribution(failures, si);
    checkSatelliteIndexing(failures, si, satellites);
    console.log(`  ring closure…`);
    checkRingClosure(failures, si, satellites, edgeA, edgeB, edgeCross);
    console.log(`  plane adjacency…`);
    checkPlaneAdjacency(failures, si, satellites, edgeA, edgeB, edgeCross);
    checkCrossPartnerWalker(failures, si, satellites, edgeA, edgeB, edgeCross);
    console.log(`  seam links…`);
    checkSeamLinks(failures, si, satellites, edgeA, edgeB, edgeCross);
    checkExpectedEdgeSet(failures, si, satellites, edgeA, edgeB, edgeCross);
  }

  const ring = edgeCross.filter((c) => !c).length;
  const cross = edgeCross.filter((c) => c).length;
  console.log('');
  console.log(
    `Graph: ${satellites.length.toLocaleString()} nodes, ${edgeA.length.toLocaleString()} edges (${ring.toLocaleString()} ring + ${cross.toLocaleString()} cross)`
  );

  if (failures.length === 0) {
    console.log('\nPASS — all Layer 2 topology invariants satisfied.');
    summarizeCheckGroups(failures);
    process.exit(0);
  }

  console.log(`\nFAIL — ${failures.length} topology violation(s).`);
  summarizeCheckGroups(failures);
  printFailures(failures);
  process.exit(1);
}

main();
