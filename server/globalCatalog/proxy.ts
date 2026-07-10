import { PIPELINE_API_URL } from '../config.js';

const PIPELINE_GLOBAL_TIMEOUT_MS = 120_000;

export async function pipelineGlobalFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${PIPELINE_API_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Starlink-Terminal/1.0',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(PIPELINE_GLOBAL_TIMEOUT_MS),
  });
}

export async function pipelineGlobalJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await pipelineGlobalFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      detail = parsed.detail ?? text;
    } catch {
      /* keep raw text */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
