import { useCallback, useEffect, useState } from 'react';
import { STARLINK_CATALOG_REFRESH_MS, type StarlinkCatalogPayload } from '../types/orbital';

async function fetchStarlinkCatalog(): Promise<StarlinkCatalogPayload> {
  const res = await fetch('/api/orbital/starlink');
  if (!res.ok) throw new Error('Failed to fetch Starlink catalog');
  return res.json() as Promise<StarlinkCatalogPayload>;
}

export function useStarlinkCatalogData(enabled: boolean) {
  const [data, setData] = useState<StarlinkCatalogPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const payload = await fetchStarlinkCatalog();
      setData(payload);
      setError(null);
    } catch {
      setError('Starlink catalog unavailable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(refresh, STARLINK_CATALOG_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  return { data, isLoading, error, refresh };
}
