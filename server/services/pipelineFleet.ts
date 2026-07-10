import { coalesceAsync, getCached, setCache } from '../cache.js';
import { PIPELINE_API_URL, PIPELINE_CACHE_TTL_MS } from '../config.js';
import { getDb } from '../satStats/db.js';
import { getLatestSnapshot } from '../satStats/snapshot.js';
import {
  STARLINK_FLEET_SNAPSHOT,
  type StarlinkFleetSnapshot,
} from '../../src/data/starlinkFleetSnapshot.ts';
import {
  pickLatestPlausibleMonthEnd,
  sanitizeFleetSnapshotDate,
} from '../../src/utils/fleetSnapshotDate.ts';

const PIPELINE_FETCH_TIMEOUT_MS = 8_000;

export type PipelineFleetSource = 'sat-stats' | 'pipeline' | 'static';

export interface PipelineFleetMeta {
  source: PipelineFleetSource;
  snapshotId?: number;
  pipelineFetchedAt?: string;
}

export interface ResolvedFleetSnapshot {
  fleet: StarlinkFleetSnapshot;
  meta: PipelineFleetMeta;
}

interface PipelineFeedRow {
  month_end?: string;
  [key: string]: string | number | undefined;
}

interface PipelineSnapshotResponse {
  snapshot_id?: number;
  created_at?: string;
  feeds?: {
    active_vs_deorbited_sats?: PipelineFeedRow[];
    sat_model_segmentation?: PipelineFeedRow[];
    bandwidth_vs_customers?: PipelineFeedRow[];
  };
  dashboard?: {
    active_satellites?: number;
    deorbited_satellites?: number;
    constellation_bw_tbps?: number;
  };
}

function toInt(value: unknown): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function toFloat(value: unknown): number {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function latestFeedRow(rows: PipelineFeedRow[] | undefined): PipelineFeedRow | null {
  return pickLatestPlausibleMonthEnd(rows);
}

export function parsePipelineSnapshotToFleet(
  snap: PipelineSnapshotResponse
): StarlinkFleetSnapshot | null {
  const activeRow = latestFeedRow(snap.feeds?.active_vs_deorbited_sats);
  const modelRow = latestFeedRow(snap.feeds?.sat_model_segmentation);
  const bwRow = latestFeedRow(snap.feeds?.bandwidth_vs_customers);

  if (!activeRow?.month_end) {
    const dash = snap.dashboard;
    if (!dash) return null;
    return {
      snapshotDate: snap.created_at?.slice(0, 10) ?? STARLINK_FLEET_SNAPSHOT.snapshotDate,
      totalInOrbit: toInt(dash.active_satellites),
      totalWorking: toInt(dash.active_satellites),
      totalDown: toInt(dash.deorbited_satellites),
      models: { ...STARLINK_FLEET_SNAPSHOT.models },
      totalBandwidthInOrbitTbps: toFloat(dash.constellation_bw_tbps),
    };
  }

  if (!modelRow || !bwRow) return null;

  return {
    snapshotDate: sanitizeFleetSnapshotDate(String(activeRow.month_end)),
    totalInOrbit: toInt(activeRow.total_in_orbit) || toInt(activeRow.active_satellites),
    totalWorking: toInt(activeRow.active_satellites),
    totalDown: toInt(activeRow.deorbited_satellites),
    models: {
      v1: toInt(modelRow.v1),
      v15: toInt(modelRow.v15),
      v2Mini: toInt(modelRow.v2_mini),
      v2MiniD2c: toInt(modelRow.v2_mini_d2c),
      v2MiniOpt: toInt(modelRow.v2_mini_opt),
    },
    totalBandwidthInOrbitTbps: toFloat(bwRow.total_bandwidth_tbps),
  };
}

function fetchLocalSatStatsSnapshot(): PipelineSnapshotResponse | null {
  try {
    const snap = getLatestSnapshot(getDb());
    if (!snap) return null;
    return {
      snapshot_id: snap.snapshot_id,
      created_at: snap.created_at,
      feeds: snap.feeds as PipelineSnapshotResponse['feeds'],
      dashboard: snap.dashboard as PipelineSnapshotResponse['dashboard'],
    };
  } catch {
    return null;
  }
}

async function fetchPipelineSnapshot(): Promise<PipelineSnapshotResponse | null> {
  try {
    const res = await fetch(`${PIPELINE_API_URL}/snapshot/latest`, {
      headers: { Accept: 'application/json', 'User-Agent': 'SPCX-Terminal/1.0' },
      signal: AbortSignal.timeout(PIPELINE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as PipelineSnapshotResponse;
  } catch {
    return null;
  }
}

export async function resolveFleetSnapshot(): Promise<ResolvedFleetSnapshot> {
  const cacheKey = 'pipeline:fleet:v1';
  const cached = getCached<ResolvedFleetSnapshot>(cacheKey);
  if (cached) return cached;

  return coalesceAsync(`${cacheKey}:fetch`, async () => {
    const again = getCached<ResolvedFleetSnapshot>(cacheKey);
    if (again) return again;

    const localSnap = fetchLocalSatStatsSnapshot();
    if (localSnap) {
      const fleet = parsePipelineSnapshotToFleet(localSnap);
      if (fleet) {
        const resolved: ResolvedFleetSnapshot = {
          fleet,
          meta: {
            source: 'sat-stats',
            snapshotId: localSnap.snapshot_id,
            pipelineFetchedAt: localSnap.created_at,
          },
        };
        setCache(cacheKey, resolved, PIPELINE_CACHE_TTL_MS);
        return resolved;
      }
    }

    const snap = await fetchPipelineSnapshot();
    if (snap) {
      const fleet = parsePipelineSnapshotToFleet(snap);
      if (fleet) {
        const resolved: ResolvedFleetSnapshot = {
          fleet,
          meta: {
            source: 'pipeline',
            snapshotId: snap.snapshot_id,
            pipelineFetchedAt: snap.created_at,
          },
        };
        setCache(cacheKey, resolved, PIPELINE_CACHE_TTL_MS);
        return resolved;
      }
    }

    const fallback: ResolvedFleetSnapshot = {
      fleet: STARLINK_FLEET_SNAPSHOT,
      meta: { source: 'static' },
    };
    setCache(cacheKey, fallback, PIPELINE_CACHE_TTL_MS);
    return fallback;
  });
}
