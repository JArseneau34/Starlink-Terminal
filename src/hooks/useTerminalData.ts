import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { StockQuote, MarketStats, UserSettings, DataSourceStatus } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { refreshTerminalData, forceRefreshCache } from '../services/api';
import { useQuoteStream } from './useQuoteStream';

function isNewerOrChanged(existing: StockQuote | undefined, incoming: StockQuote): boolean {
  if (!existing) return true;
  if (incoming.lastUpdated >= existing.lastUpdated) return true;
  return (
    existing.price !== incoming.price ||
    existing.change !== incoming.change ||
    existing.changePercent !== incoming.changePercent ||
    existing.volume !== incoming.volume ||
    existing.session !== incoming.session
  );
}

function mergeQuoteMaps(
  prev: Map<string, StockQuote>,
  incoming: Map<string, StockQuote>
): Map<string, StockQuote> {
  const next = new Map(prev);
  for (const [sym, q] of incoming) {
    const existing = next.get(sym);
    if (isNewerOrChanged(existing, q)) {
      next.set(sym, q);
    }
  }
  return next;
}

export function useTerminalData(settings: UserSettings = DEFAULT_SETTINGS) {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [launches, setLaunches] = useState<Awaited<ReturnType<typeof refreshTerminalData>>['launches']>([]);
  const [news, setNews] = useState<Awaited<ReturnType<typeof refreshTerminalData>>['news']>([]);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshGenRef = useRef(0);
  const hasDataRef = useRef(false);

  const applyQuoteUpdate = useCallback((quote: StockQuote) => {
    setQuotes((prev) => {
      const existing = prev.get(quote.symbol);
      if (!isNewerOrChanged(existing, quote)) return prev;
      const next = new Map(prev);
      next.set(quote.symbol, quote);
      return next;
    });
    setLastRefresh(new Date());
  }, []);

  const applySnapshot = useCallback((snapshot: Map<string, StockQuote>) => {
    setQuotes((prev) => mergeQuoteMaps(prev, snapshot));
    setLastRefresh(new Date());
  }, []);

  const { isStreaming, streamSource, streamStatus } = useQuoteStream(applyQuoteUpdate, applySnapshot);

  const mergedSources = useMemo(() => {
    if (!streamSource) return sources;
    const rest = sources.filter((s) => s.name !== 'Quote Stream');
    return [...rest, streamSource];
  }, [sources, streamSource]);

  const refresh = useCallback(async (clearServerCache = false) => {
    const gen = ++refreshGenRef.current;
    if (!hasDataRef.current) setIsLoading(true);
    setError(null);
    try {
      if (clearServerCache) await forceRefreshCache();
      const data = await refreshTerminalData();
      if (gen !== refreshGenRef.current) return;
      setQuotes((prev) => mergeQuoteMaps(prev, data.quotes));
      setLaunches(data.launches);
      setNews(data.news);
      setMarketStats(data.marketStats);
      setSources(data.sources);
      setLastRefresh(new Date());
      hasDataRef.current = true;
    } catch {
      if (gen !== refreshGenRef.current) return;
      if (!hasDataRef.current) {
        setError('Failed to refresh — is the API server running? (npm run dev)');
      }
    } finally {
      if (gen === refreshGenRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refresh, settings.refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, settings.refreshInterval]);

  return {
    quotes,
    launches,
    news,
    marketStats,
    lastRefresh,
    isLoading,
    isStreaming,
    marketSession: streamStatus?.marketSession,
    extendedHours: streamStatus?.extendedHours,
    error,
    sources: mergedSources,
    refresh,
  };
}
