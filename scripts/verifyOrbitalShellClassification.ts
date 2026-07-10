/**
 * Orbital shell classifier sanity checks.
 * Usage: npm run verify:shell-classification
 */

import { classifyOrbitalShell } from '../src/data/orbitalShellClassification.ts';
import { shellReferenceByKey } from '../src/data/shellReference.ts';

interface Case {
  name: string;
  inc: number;
  altKm: number;
  expectedKey: string;
}

const CASES: Case[] = [
  {
    name: 'G1 primary 550km 53.0°',
    inc: 53.0,
    altKm: 550,
    expectedKey: 'gen1:1',
  },
  {
    name: 'G1 53.2° shell',
    inc: 53.2,
    altKm: 540,
    expectedKey: 'gen1:4',
  },
  {
    name: 'G2 primary 525km 53.0°',
    inc: 53.0,
    altKm: 525,
    expectedKey: 'gen2:1',
  },
];

let failures = 0;

for (const c of CASES) {
  const assignment = classifyOrbitalShell(
    {
      inclination: c.inc,
      meanAltKm: c.altKm,
      perigeeKm: c.altKm - 5,
      apogeeKm: c.altKm + 5,
      eccentricity: 0.0001,
    },
    'operational'
  );
  const expected = shellReferenceByKey(c.expectedKey);
  const ok =
    !assignment.isTransit &&
    assignment.shellKey === c.expectedKey &&
    assignment.structuralIndex === expected?.structuralIndex;

  if (!ok) {
    failures++;
    console.error(
      `FAIL ${c.name}: expected ${c.expectedKey} (index ${expected?.structuralIndex}), ` +
        `got ${assignment.shellKey ?? 'transit'} (index ${assignment.structuralIndex})`
    );
  } else {
    console.log(`PASS ${c.name} → ${assignment.shellName}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} classifier check(s) failed`);
  process.exit(1);
}

console.log('\nAll orbital shell classifier checks passed.');
