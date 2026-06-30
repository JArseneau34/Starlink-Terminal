import { STARLINK_LAUNCH_ARCHIVE } from '../data/starlinkLaunchArchive';

/**
 * Per-satellite downlink capacity (Gbps) by hardware generation. Mirrors the authoritative
 * assumption matrix in Space-Industry-Data-Pipeline (sources.py parse_mcdowell_snapshot_html),
 * which is what produces the constellation Tbps figure. Direct-to-cell payloads carry no
 * broadband capacity and are folded into their bus model's broadband-capable count here.
 */
const GBPS_PER_SAT_BY_MODEL: Record<string, number> = {
  'v0.9': 12,
  v1: 12,
  'v1.0': 12,
  'v1.5': 24,
  'v2 mini': 96,
  'v2 mini opt': 96,
};

function normalizeModel(model: string | null): string | null {
  if (!model) return null;
  const key = model.trim().toLowerCase();
  return key in GBPS_PER_SAT_BY_MODEL ? key : null;
}

function quarterKey(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export interface LaunchProductivityQuarter {
  quarter: string;
  launches: number;
  satsPerLaunch: number;
  gbpsPerLaunch: number;
}

export interface LaunchProductivitySnapshot {
  quarters: LaunchProductivityQuarter[];
  first: LaunchProductivityQuarter | null;
  latest: LaunchProductivityQuarter | null;
  satsDeltaPct: number;
  gbpsDeltaPct: number;
}

/**
 * Aggregates the launch archive into per-quarter productivity: the average satellites and
 * average broadband capacity (Gbps) delivered per Starlink launch. Only launches with a known
 * hardware model are counted so the capacity figure stays consistent with the fleet bandwidth model.
 */
export function buildLaunchProductivity(): LaunchProductivitySnapshot {
  const buckets = new Map<string, { launches: number; sats: number; gbps: number }>();

  for (const entry of STARLINK_LAUNCH_ARCHIVE) {
    const model = normalizeModel(entry.starlinkModel);
    if (!model || entry.numberOfStarlinkSatellites <= 0) continue;
    const key = quarterKey(entry.dateUtc);
    if (!key) continue;

    const bucket = buckets.get(key) ?? { launches: 0, sats: 0, gbps: 0 };
    bucket.launches += 1;
    bucket.sats += entry.numberOfStarlinkSatellites;
    bucket.gbps += entry.numberOfStarlinkSatellites * GBPS_PER_SAT_BY_MODEL[model]!;
    buckets.set(key, bucket);
  }

  const quarters: LaunchProductivityQuarter[] = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([quarter, b]) => ({
      quarter,
      launches: b.launches,
      satsPerLaunch: b.sats / b.launches,
      gbpsPerLaunch: b.gbps / b.launches,
    }));

  const first = quarters[0] ?? null;
  const latest = quarters[quarters.length - 1] ?? null;

  const satsDeltaPct =
    first && latest && first.satsPerLaunch > 0
      ? (latest.satsPerLaunch / first.satsPerLaunch - 1) * 100
      : 0;
  const gbpsDeltaPct =
    first && latest && first.gbpsPerLaunch > 0
      ? (latest.gbpsPerLaunch / first.gbpsPerLaunch - 1) * 100
      : 0;

  return { quarters, first, latest, satsDeltaPct, gbpsDeltaPct };
}

export function formatQuarter(quarter: string): string {
  const [year, q] = quarter.split('-');
  return `${q} '${year?.slice(2) ?? ''}`;
}
