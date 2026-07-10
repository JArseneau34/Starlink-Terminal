import { SAT_STATS_FETCH_TIMEOUT_MS, SAT_STATS_USER_AGENT } from './config.js';

export async function satStatsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', SAT_STATS_USER_AGENT);
  if (!headers.has('Accept')) headers.set('Accept', '*/*');
  return fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(SAT_STATS_FETCH_TIMEOUT_MS),
  });
}

export async function satStatsFetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await satStatsFetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function satStatsFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await satStatsFetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}
