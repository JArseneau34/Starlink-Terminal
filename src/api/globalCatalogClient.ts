import type {
  GlobalCatalogBootstrapStatus,
  GlobalCatalogReview,
  GlobalCatalogSnapshot,
  GlobalCatalogUpdateResult,
} from '../types/globalCatalog';

async function globalCatalogFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/global-catalog${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? text;
    } catch {
      /* keep raw */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export async function fetchGlobalCatalogSnapshot(): Promise<GlobalCatalogSnapshot> {
  return globalCatalogFetch('/snapshot/latest');
}

export async function fetchGlobalCatalogReviews(): Promise<GlobalCatalogReview[]> {
  const body = await globalCatalogFetch<{ reviews: GlobalCatalogReview[] }>('/reviews');
  return body.reviews;
}

export async function fetchGlobalBootstrapStatus(): Promise<GlobalCatalogBootstrapStatus> {
  return globalCatalogFetch('/bootstrap/status');
}

export async function runGlobalCatalogUpdate(): Promise<GlobalCatalogUpdateResult> {
  return globalCatalogFetch('/update', { method: 'POST', body: '{}' });
}

export async function runGlobalBootstrap(force = false): Promise<GlobalCatalogUpdateResult> {
  const q = force ? '?force=true' : '';
  return globalCatalogFetch(`/bootstrap${q}`, { method: 'POST', body: '{}' });
}

export async function approveGlobalReview(id: number): Promise<void> {
  await globalCatalogFetch(`/reviews/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', reviewer: 'investor-ui' }),
  });
}

export async function rejectGlobalReview(id: number): Promise<void> {
  await globalCatalogFetch(`/reviews/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'reject', reviewer: 'investor-ui' }),
  });
}

export async function approveAllGlobalReviews(): Promise<{ approved_count: number }> {
  return globalCatalogFetch('/reviews/approve-all', {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'investor-ui' }),
  });
}

export async function downloadGlobalCatalogCsvZip(): Promise<void> {
  const res = await fetch('/api/global-catalog/publish/csv-download', { method: 'POST' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'global-catalogue-csvs.zip';
  a.click();
  URL.revokeObjectURL(url);
}

export async function publishGlobalCatalogApi(apiEndpoint: string): Promise<unknown> {
  return globalCatalogFetch('/publish', {
    method: 'POST',
    body: JSON.stringify({ api_endpoint: apiEndpoint, actor: 'investor-ui' }),
  });
}
