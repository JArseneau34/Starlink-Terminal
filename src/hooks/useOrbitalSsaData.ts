import { useCallback, useEffect, useState } from 'react';
import type { SsaPayload } from '../types/orbital';

const REFRESH_MS = 5 * 60_000;

async function fetchSsa(): Promise<SsaPayload> {
  const res = await fetch('/api/orbital/ssa');
  if (!res.ok) throw new Error('Failed to fetch SSA data');
  return res.json() as Promise<SsaPayload>;
}

export function useOrbitalSsaData(enabled: boolean) {
  const [data, setData] = useState<SsaPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const payload = await fetchSsa();
      setData(payload);
    } catch {
      setError('SSA feed unavailable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  return { data, isLoading, error, refresh };
}
