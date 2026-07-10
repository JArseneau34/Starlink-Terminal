import { useCallback, useEffect, useState } from 'react';
import type { WalkerFitPayload } from '../walkerFit/types';

async function fetchWalkerFit(): Promise<WalkerFitPayload> {
  const res = await fetch('/api/orbital/starlink/walker-fit');
  if (res.ok) return res.json() as Promise<WalkerFitPayload>;
  const staticRes = await fetch('/orbital/walker-fit.json');
  if (!staticRes.ok) throw new Error('Walker fit feed unavailable');
  return staticRes.json() as Promise<WalkerFitPayload>;
}

export function useWalkerFitData(enabled = true) {
  const [fit, setFit] = useState<WalkerFitPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setFit(await fetchWalkerFit());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Walker fit failed');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { fit, error, loading, refresh };
}
