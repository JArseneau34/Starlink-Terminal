/**
 * FCC orbital shell reference — single source of truth for Walker topology,
 * slot math, and modeled−live comparison. Hardware models populate shells but
 * do not define them.
 */

export type ConstellationGen = 'gen1' | 'gen2';
export type ShellStatus = 'granted' | 'pending';
export type ShellSource = 'fcc' | 'fitted';

export interface ShellReferenceRow {
  /** Stable key, e.g. gen1:1 */
  key: string;
  structuralIndex: number;
  constellationGen: ConstellationGen;
  shellId: number;
  altKm: number;
  incDeg: number;
  planes: number | null;
  satsPerPlane: number | null;
  totalSats: number;
  phasingF: number | null;
  status: ShellStatus;
  source: ShellSource;
  color: number;
  notes?: string;
}

/** Gen1 granted = 4,408 · Gen2 granted = 7,500 */
export const SHELL_REFERENCE: readonly ShellReferenceRow[] = [
  // —— Gen1 granted ——
  {
    key: 'gen1:1',
    structuralIndex: 0,
    constellationGen: 'gen1',
    shellId: 1,
    altKm: 550,
    incDeg: 53.0,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0x3de8ff,
    notes: 'Gen1 primary mid-inclination shell',
  },
  {
    key: 'gen1:2',
    structuralIndex: 1,
    constellationGen: 'gen1',
    shellId: 2,
    altKm: 570,
    incDeg: 70.0,
    planes: 36,
    satsPerPlane: 20,
    totalSats: 720,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0xa78bfa,
    notes: 'Gen1 polar shell',
  },
  {
    key: 'gen1:3',
    structuralIndex: 2,
    constellationGen: 'gen1',
    shellId: 3,
    altKm: 560,
    incDeg: 97.6,
    planes: 6,
    satsPerPlane: 58,
    totalSats: 348,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0xff6bd6,
    notes: 'Gen1 SSO shell A (6×58)',
  },
  {
    key: 'gen1:4',
    structuralIndex: 3,
    constellationGen: 'gen1',
    shellId: 4,
    altKm: 540,
    incDeg: 53.2,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0x22c9e8,
    notes: 'Gen1 53.2° shell',
  },
  {
    key: 'gen1:5',
    structuralIndex: 4,
    constellationGen: 'gen1',
    shellId: 5,
    altKm: 560,
    incDeg: 97.6,
    planes: 4,
    satsPerPlane: 43,
    totalSats: 172,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0xe879f9,
    notes: 'Gen1 SSO shell B (4×43) — same inc/alt as shell 3; split at fit time',
  },
  // —— Gen2 granted (Dec 2022 partial grant) ——
  {
    key: 'gen2:1',
    structuralIndex: 5,
    constellationGen: 'gen2',
    shellId: 1,
    altKm: 525,
    incDeg: 53.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0x2ee86a,
    notes: 'Gen2 primary 53.0° shell',
  },
  {
    key: 'gen2:2',
    structuralIndex: 6,
    constellationGen: 'gen2',
    shellId: 2,
    altKm: 530,
    incDeg: 43.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0xffb84b,
    notes: 'Gen2 43° shell',
  },
  {
    key: 'gen2:3',
    structuralIndex: 7,
    constellationGen: 'gen2',
    shellId: 3,
    altKm: 535,
    incDeg: 33.0,
    planes: null,
    satsPerPlane: null,
    totalSats: 780,
    phasingF: null,
    status: 'granted',
    source: 'fcc',
    color: 0xff9a3d,
    notes: 'Gen2 33° partial grant — plane×slot split not specified in order',
  },
  // —— Gen2 pending (ungranted remainder incl. VLEO) ——
  {
    key: 'gen2:4',
    structuralIndex: 8,
    constellationGen: 'gen2',
    shellId: 4,
    altKm: 340,
    incDeg: 53.0,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x1a5c38,
    notes: 'Gen2 VLEO application — not granted',
  },
  {
    key: 'gen2:5',
    structuralIndex: 9,
    constellationGen: 'gen2',
    shellId: 5,
    altKm: 345,
    incDeg: 53.0,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x1a4a32,
    notes: 'Gen2 VLEO application — not granted',
  },
  {
    key: 'gen2:6',
    structuralIndex: 10,
    constellationGen: 'gen2',
    shellId: 6,
    altKm: 350,
    incDeg: 53.0,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x163d2a,
    notes: 'Gen2 VLEO application — not granted',
  },
  {
    key: 'gen2:7',
    structuralIndex: 11,
    constellationGen: 'gen2',
    shellId: 7,
    altKm: 360,
    incDeg: 53.0,
    planes: 72,
    satsPerPlane: 22,
    totalSats: 1584,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x123022,
    notes: 'Gen2 VLEO application — not granted',
  },
  {
    key: 'gen2:8',
    structuralIndex: 12,
    constellationGen: 'gen2',
    shellId: 8,
    altKm: 340,
    incDeg: 43.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x5c4018,
    notes: 'Gen2 VLEO 43° — not granted',
  },
  {
    key: 'gen2:9',
    structuralIndex: 13,
    constellationGen: 'gen2',
    shellId: 9,
    altKm: 350,
    incDeg: 43.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x4a3414,
    notes: 'Gen2 VLEO 43° — not granted',
  },
  {
    key: 'gen2:10',
    structuralIndex: 14,
    constellationGen: 'gen2',
    shellId: 10,
    altKm: 360,
    incDeg: 33.0,
    planes: 12,
    satsPerPlane: 65,
    totalSats: 780,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x5c3810,
    notes: 'Gen2 VLEO 33° — not granted',
  },
  {
    key: 'gen2:11',
    structuralIndex: 15,
    constellationGen: 'gen2',
    shellId: 11,
    altKm: 604,
    incDeg: 53.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x1a4a28,
    notes: 'Gen2 mid-alt application shell — not granted',
  },
  {
    key: 'gen2:12',
    structuralIndex: 16,
    constellationGen: 'gen2',
    shellId: 12,
    altKm: 614,
    incDeg: 53.0,
    planes: 28,
    satsPerPlane: 120,
    totalSats: 3360,
    phasingF: null,
    status: 'pending',
    source: 'fcc',
    color: 0x163d22,
    notes: 'Gen2 mid-alt application shell — not granted',
  },
] as const;

export const SHELL_REFERENCE_COUNT = SHELL_REFERENCE.length;

/** Pseudo-shell index for orbit-raising / deorbiting / unclassified objects. */
export const TRANSIT_SHELL_INDEX = SHELL_REFERENCE_COUNT;

export const GRANTED_SHELL_REFERENCE = SHELL_REFERENCE.filter((r) => r.status === 'granted');
export const PENDING_SHELL_REFERENCE = SHELL_REFERENCE.filter((r) => r.status === 'pending');
export const GRANTED_SHELL_COUNT = GRANTED_SHELL_REFERENCE.length;
export const PENDING_TOPOLOGY_TOTAL = PENDING_SHELL_REFERENCE.reduce((sum, r) => sum + r.totalSats, 0);

/** Granted FCC shells + transit — pending application shells excluded until active. */
export const ORBITAL_SHELL_FILTER_INDICES: readonly number[] = [
  ...GRANTED_SHELL_REFERENCE.map((r) => r.structuralIndex),
  TRANSIT_SHELL_INDEX,
];

export const ORBITAL_SHELL_FILTER_COUNT = ORBITAL_SHELL_FILTER_INDICES.length;

export function allOrbitalShellFilterIndices(): ReadonlySet<number> {
  return new Set(ORBITAL_SHELL_FILTER_INDICES);
}

export function isGrantedShellIndex(index: number): boolean {
  return index >= 0 && index < GRANTED_SHELL_COUNT;
}

export function shellReferenceByIndex(index: number): ShellReferenceRow | undefined {
  return SHELL_REFERENCE[index];
}

export function shellReferenceByKey(key: string): ShellReferenceRow | undefined {
  return SHELL_REFERENCE.find((r) => r.key === key);
}

export function grantedShellTotal(gen?: ConstellationGen): number {
  const rows = gen
    ? GRANTED_SHELL_REFERENCE.filter((r) => r.constellationGen === gen)
    : GRANTED_SHELL_REFERENCE;
  return rows.reduce((sum, r) => sum + r.totalSats, 0);
}

export const GEN1_GRANTED_TOTAL = grantedShellTotal('gen1');
export const GEN2_GRANTED_TOTAL = grantedShellTotal('gen2');
export const GRANTED_TOPOLOGY_TOTAL = grantedShellTotal();

export function formatShellLabel(row: ShellReferenceRow): string {
  const gen = row.constellationGen === 'gen1' ? 'G1' : 'G2';
  const inc = row.incDeg.toFixed(1).replace(/\.0$/, '');
  const base = `${gen} · ${row.altKm}km ${inc}°`;
  if (row.incDeg >= 97) {
    const planes = row.planes ?? deriveWalkerGrid(row.totalSats).planes;
    return `${base} · ${planes}p`;
  }
  return base;
}

export function shellDisplayName(row: ShellReferenceRow): string {
  return formatShellLabel(row);
}

/** Derive Walker plane×slot grid when FCC order omits the split. */
export function deriveWalkerGrid(totalSats: number): { planes: number; satsPerPlane: number } {
  let best = { planes: 1, satsPerPlane: totalSats, score: Infinity };
  const maxPlanes = Math.min(120, Math.ceil(Math.sqrt(totalSats) * 3));
  for (let planes = 2; planes <= maxPlanes; planes++) {
    if (totalSats % planes !== 0) continue;
    const satsPerPlane = totalSats / planes;
    const score = Math.abs(planes - satsPerPlane) + Math.abs(planes - Math.sqrt(totalSats));
    if (score < best.score) {
      best = { planes, satsPerPlane, score };
    }
  }
  return { planes: best.planes, satsPerPlane: best.satsPerPlane };
}

export function resolveShellPlanes(row: ShellReferenceRow): number {
  if (row.planes != null) return row.planes;
  return deriveWalkerGrid(row.totalSats).planes;
}

export function resolveShellSatsPerPlane(row: ShellReferenceRow, planes: number): number {
  if (row.satsPerPlane != null) return row.satsPerPlane;
  return Math.ceil(row.totalSats / planes);
}
