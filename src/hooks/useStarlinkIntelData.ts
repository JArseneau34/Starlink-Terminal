import { useCallback, useEffect, useState } from 'react';
import type { StarlinkIntelPayload } from '../types/orbital';

const REFRESH_MS = 5 * 60_000;

async function fetchStarlinkIntel(): Promise<StarlinkIntelPayload> {
  const res = await fetch('/api/orbital/starlink/intel');
  if (!res.ok) throw new Error('Failed to fetch Starlink intel');
  return res.json() as Promise<StarlinkIntelPayload>;
}

export function useStarlinkIntelData(enabled: boolean) {
  const [data, setData] = useState<StarlinkIntelPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const payload = await fetchStarlinkIntel();
      setData(payload);
    } catch {
      setError('Starlink intel unavailable');
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
