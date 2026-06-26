import type { Launch } from '../types';
import type { StarlinkSatMeta } from '../types/orbital';
import { catalogIndex, planeSatCounts, STARLINK_SHELLS } from '../components/starlink/starlinkCatalog';

export interface StarlinkDeploymentSpec {
  /** Stable key for UI selection */
  key: string;
  launchName: string;
  shell: number;
  plane: number;
  slotStart: number;
  count: number;
  pad?: string;
  note?: string;
}

export function indicesForDeployment(spec: StarlinkDeploymentSpec): number[] {
  const sh = STARLINK_SHELLS[spec.shell]!;
  const counts = planeSatCounts(sh);
  const indices: number[] = [];
  let remaining = spec.count;
  let plane = spec.plane % sh.planes;
  let slot = spec.slotStart % counts[plane]!;

  while (remaining > 0) {
    const planeSats = counts[plane]!;
    const slotsLeft = planeSats - slot;
    const take = Math.min(remaining, slotsLeft);
    for (let s = slot; s < slot + take; s++) {
      indices.push(catalogIndex(spec.shell, plane, s));
    }
    remaining -= take;
    plane = (plane + 1) % sh.planes;
    slot = 0;
  }

  return indices;
}

export function buildDeploymentIndexSet(spec: StarlinkDeploymentSpec): ReadonlySet<number> {
  return new Set(indicesForDeployment(spec));
}

/** Curated mesh slots for known Starlink missions (synthetic catalog mapping). */
export const STARLINK_DEPLOYMENT_SPECS: StarlinkDeploymentSpec[] = [
  {
    key: 'sl-12-18',
    launchName: 'Starlink Group 12-18',
    shell: 0,
    plane: 12,
    slotStart: 0,
    count: 23,
    pad: 'SLC-40',
    note: '53.0° shell · Cape replenishment',
  },
  {
    key: 'sl-10-30',
    launchName: 'Starlink Group 10-30',
    shell: 1,
    plane: 10,
    slotStart: 2,
    count: 22,
    pad: 'SLC-4E',
    note: '53.2° shell · Vandenberg plane fill',
  },
  {
    key: 'sl-6-85',
    launchName: 'Starlink Group 6-85',
    shell: 0,
    plane: 6,
    slotStart: 5,
    count: 23,
    pad: 'SLC-40',
    note: 'Direct-to-cell capable batch',
  },
  {
    key: 'sl-9-17',
    launchName: 'Starlink Group 9-17',
    shell: 1,
    plane: 9,
    slotStart: 0,
    count: 20,
    pad: 'SLC-4E',
    note: 'West coast shell maintenance',
  },
  {
    key: 'sl-11-7',
    launchName: 'Starlink Group 11-7',
    shell: 0,
    plane: 11,
    slotStart: 8,
    count: 22,
    pad: 'SLC-40',
  },
  {
    key: 'sl-7-42',
    launchName: 'Starlink Group 7-42',
    shell: 0,
    plane: 7,
    slotStart: 0,
    count: 23,
    pad: 'SLC-40',
  },
  {
    key: 'sl-8-21',
    launchName: 'Starlink Group 8-21',
    shell: 1,
    plane: 8,
    slotStart: 4,
    count: 21,
    pad: 'SLC-4E',
  },
  {
    key: 'sl-10-9',
    launchName: 'Starlink Group 10-9',
    shell: 1,
    plane: 10,
    slotStart: 0,
    count: 20,
    pad: 'SLC-4E',
  },
  {
    key: 'sl-6-58',
    launchName: 'Starlink Group 6-58',
    shell: 0,
    plane: 6,
    slotStart: 12,
    count: 22,
    pad: 'SLC-40',
  },
  {
    key: 'sl-12-5',
    launchName: 'Starlink Group 12-5',
    shell: 4,
    plane: 4,
    slotStart: 0,
    count: 16,
    pad: 'SLC-4E',
    note: '70.0° polar shell insertion',
  },
  {
    key: 'sl-3-44',
    launchName: 'Starlink Group 3-44',
    shell: 5,
    plane: 3,
    slotStart: 2,
    count: 16,
    pad: 'SLC-4E',
    note: '97.6° SSO shell',
  },
];

const SPEC_BY_NAME = new Map(
  STARLINK_DEPLOYMENT_SPECS.map((s) => [s.launchName.toLowerCase(), s])
);

export function isStarlinkLaunch(launch: Launch): boolean {
  const text = `${launch.name} ${launch.mission ?? ''} ${launch.provider}`;
  return /starlink/i.test(text);
}

function inferFromGroupName(name: string, launchId: string): StarlinkDeploymentSpec | null {
  const m = name.match(/starlink.*?group\s+(\d+)-(\d+)/i);
  if (!m) return null;

  const group = Number(m[1]);
  const batch = Number(m[2]);
  const shell =
    group >= 12 ? 4 : group >= 10 ? 1 : group >= 6 ? 0 : group >= 4 ? 2 : group >= 3 ? 5 : 0;
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const plane = (group * 2 + batch) % sh.planes;
  const slotStart = (batch * 3) % counts[plane]!;
  const count = shell >= 4 ? 16 : batch % 3 === 0 ? 23 : 22;

  return {
    key: `inferred-${launchId}`,
    launchName: name,
    shell,
    plane,
    slotStart,
    count,
    note: 'Inferred plane assignment from group ID',
  };
}

export function resolveDeploymentForLaunch(launch: Launch): StarlinkDeploymentSpec | null {
  if (!isStarlinkLaunch(launch)) return null;

  const exact = SPEC_BY_NAME.get(launch.name.toLowerCase());
  if (exact) return { ...exact, key: launch.id || exact.key };

  const partial = STARLINK_DEPLOYMENT_SPECS.find((s) =>
    launch.name.toLowerCase().includes(s.launchName.toLowerCase())
  );
  if (partial) return { ...partial, key: launch.id || partial.key };

  return inferFromGroupName(launch.name, launch.id);
}

export interface StarlinkLaunchOption {
  launch: Launch;
  spec: StarlinkDeploymentSpec;
  indices: ReadonlySet<number>;
  noradIds: ReadonlySet<number>;
  shellLabel: string;
}

const EPOCH_WINDOW_BEFORE_MS = 3 * 86_400_000;
const EPOCH_WINDOW_AFTER_MS = 35 * 86_400_000;
const INCLINATION_TOLERANCE = 2.5;

/** Match live TLE catalog entries to a deployment via epoch window + inclination band. */
export function matchDeploymentToLiveCatalog(
  spec: StarlinkDeploymentSpec,
  launchDate: Date,
  catalog: StarlinkSatMeta[]
): number[] {
  const targetInc = STARLINK_SHELLS[spec.shell]?.inc ?? 53;
  const launchMs = launchDate.getTime();
  const windowStart = launchMs - EPOCH_WINDOW_BEFORE_MS;
  const windowEnd = launchMs + EPOCH_WINDOW_AFTER_MS;

  const candidates = catalog
    .filter((sat) => {
      const epochMs = Date.parse(sat.epoch);
      if (!Number.isFinite(epochMs)) return false;
      if (epochMs < windowStart || epochMs > windowEnd) return false;
      return Math.abs(sat.inclination - targetInc) <= INCLINATION_TOLERANCE;
    })
    .sort((a, b) => {
      const da = Math.abs(Date.parse(a.epoch) - launchMs);
      const db = Math.abs(Date.parse(b.epoch) - launchMs);
      if (da !== db) return da - db;
      return a.noradId - b.noradId;
    });

  return candidates.slice(0, spec.count).map((s) => s.noradId);
}

export function enrichLaunchOptionsWithLiveCatalog(
  options: StarlinkLaunchOption[],
  catalog: StarlinkSatMeta[] | null | undefined
): StarlinkLaunchOption[] {
  if (!catalog || catalog.length === 0) {
    return options.map((opt) => ({ ...opt, noradIds: new Set<number>() }));
  }

  return options.map((opt) => ({
    ...opt,
    noradIds: new Set(
      matchDeploymentToLiveCatalog(opt.spec, new Date(opt.launch.date), catalog)
    ),
  }));
}

export function deploymentForNoradId(
  noradId: number,
  options: StarlinkLaunchOption[]
): StarlinkLaunchOption | null {
  for (const opt of options) {
    if (opt.noradIds.has(noradId)) return opt;
  }
  return null;
}

export function buildDefaultStarlinkLaunchOptions(): StarlinkLaunchOption[] {
  return buildStarlinkLaunchOptions([]);
}

export function buildStarlinkLaunchOptions(launches: Launch[]): StarlinkLaunchOption[] {
  const seen = new Set<string>();
  const options: StarlinkLaunchOption[] = [];

  for (const launch of launches) {
    const spec = resolveDeploymentForLaunch(launch);
    if (!spec) continue;
    const dedupe = spec.launchName.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    options.push({
      launch,
      spec: { ...spec, launchName: launch.name },
      indices: buildDeploymentIndexSet(spec),
      noradIds: new Set<number>(),
      shellLabel: STARLINK_SHELLS[spec.shell]?.name ?? '—',
    });
  }

  for (const spec of STARLINK_DEPLOYMENT_SPECS) {
    if (seen.has(spec.launchName.toLowerCase())) continue;
    seen.add(spec.launchName.toLowerCase());
    options.push({
      launch: {
        id: spec.key,
        name: spec.launchName,
        provider: 'SpaceX',
        rocket: 'Falcon 9 Block 5',
        location: spec.pad ? `${spec.pad}, USA` : 'LEO',
        date: new Date(),
        status: 'Deployed',
        pad: spec.pad,
        mission: spec.note,
      },
      spec,
      indices: buildDeploymentIndexSet(spec),
      noradIds: new Set<number>(),
      shellLabel: STARLINK_SHELLS[spec.shell]?.name ?? '—',
    });
  }

  return options.sort(
    (a, b) => new Date(b.launch.date).getTime() - new Date(a.launch.date).getTime()
  );
}

export function deploymentForSatelliteIndex(
  satIndex: number,
  options: StarlinkLaunchOption[]
): StarlinkLaunchOption | null {
  for (const opt of options) {
    if (opt.indices.has(satIndex)) return opt;
  }
  return null;
}
