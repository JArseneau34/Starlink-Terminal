import { useCallback, useEffect, useState } from 'react';
import type { OrbitalPayload } from '../types/orbital';

const REFRESH_MS = 30_000;

async function fetchOrbital(): Promise<OrbitalPayload> {
  const res = await fetch('/api/orbital');
  if (!res.ok) throw new Error('Failed to fetch orbital data');
  return res.json() as Promise<OrbitalPayload>;
}

export function useOrbitalOpsData() {
  const [data, setData] = useState<OrbitalPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const payload = await fetchOrbital();
      setData(payload);
    } catch {
      setError('Orbital feed unavailable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
