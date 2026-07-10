import type {
  SatStatsModelAssumption,
  SatStatsReview,
  SatStatsSnapshot,
  SatStatsUpdateResult,
} from '../types/satStats';

async function satStatsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sat-stats${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export async function fetchSatStatsSnapshot(): Promise<SatStatsSnapshot> {
  return satStatsFetch('/snapshot/latest');
}

export async function fetchSatStatsReviews(): Promise<SatStatsReview[]> {
  const body = await satStatsFetch<{ reviews: SatStatsReview[] }>('/reviews');
  return body.reviews;
}

export async function fetchSatStatsAssumptions(): Promise<{
  models: SatStatsModelAssumption[];
  subscriber_anchors: { anchor_date: string; subscribers: number; source: string | null }[];
}> {
  return satStatsFetch('/assumptions');
}

export async function runSatStatsUpdate(opts?: {
  bootstrapHistorical?: boolean;
}): Promise<SatStatsUpdateResult> {
  return satStatsFetch('/update', {
    method: 'POST',
    body: JSON.stringify(opts ?? {}),
  });
}

export async function fetchHistoricalBootstrapStatus(): Promise<{
  done: boolean;
  launch_archive_count: number;
}> {
  return satStatsFetch('/bootstrap/historical-wikipedia-launches/status');
}

export async function runHistoricalBootstrap(force = false): Promise<SatStatsUpdateResult> {
  const q = force ? '?force=true' : '';
  return satStatsFetch(`/bootstrap/historical-wikipedia-launches${q}`, { method: 'POST', body: '{}' });
}

export async function runSatStatsTrueUp(): Promise<{
  review_id: number;
  report: Record<string, unknown>;
}> {
  return satStatsFetch('/true-up', { method: 'POST', body: '{}' });
}

export async function approveSatStatsReview(id: number): Promise<void> {
  await satStatsFetch(`/reviews/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'investor-ui' }),
  });
}

export async function rejectSatStatsReview(id: number): Promise<void> {
  await satStatsFetch(`/reviews/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'investor-ui' }),
  });
}

export async function approveAllSatStatsReviews(): Promise<{ approved_count: number }> {
  return satStatsFetch('/reviews/approve-all', {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'investor-ui' }),
  });
}

export async function saveModelAssumption(model: SatStatsModelAssumption): Promise<{ snapshot_id: number }> {
  return satStatsFetch('/assumptions/model', {
    method: 'POST',
    body: JSON.stringify(model),
  });
}

export async function publishSatStatsSnapshot(snapshotId: number): Promise<void> {
  await satStatsFetch('/publish', {
    method: 'POST',
    body: JSON.stringify({ snapshot_id: snapshotId, actor: 'investor-ui', mode: 'full' }),
  });
}

export async function downloadSatStatsCsvZip(snapshotId: number): Promise<void> {
  const res = await fetch(`/api/sat-stats/publish/${snapshotId}/csv-download`, { method: 'POST' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starlink-chart-feeds-snapshot-${snapshotId}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
