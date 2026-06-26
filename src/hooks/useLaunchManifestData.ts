import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApiWithRetry } from '../services/api';
import type { LaunchManifestPayload } from '../types/launchManifest';

const REFRESH_MS = 3 * 60_000;
const FETCH_TIMEOUT_MS = 45_000;

async function fetchManifest(force = false): Promise<LaunchManifestPayload> {
  const url = force ? '/api/launch-manifest?refresh=1' : '/api/launch-manifest';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchApiWithRetry(url, { signal: controller.signal });
    if (!res.ok) throw new Error('Failed to fetch launch manifest');
    return res.json() as Promise<LaunchManifestPayload>;
  } finally {
    clearTimeout(timer);
  }
}

export function useLaunchManifestData() {
  const [data, setData] = useState<LaunchManifestPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const dataRef = useRef<LaunchManifestPayload | null>(null);
  const refreshGenRef = useRef(0);
  dataRef.current = data;

  const refresh = useCallback(async (force = false) => {
    const gen = ++refreshGenRef.current;
    if (!dataRef.current) setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchManifest(force);
      if (gen !== refreshGenRef.current) return;
      setData(payload);
      setLastRefresh(new Date(payload.fetchedAt));
    } catch {
      if (gen !== refreshGenRef.current) return;
      if (!dataRef.current) {
        setError('Launch manifest feed unavailable — retry or check API server');
      }
    } finally {
      if (gen === refreshGenRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { data, isLoading, error, lastRefresh, refresh };
}
