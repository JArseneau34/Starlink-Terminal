import type { Launch, NewsItem, StockQuote, MarketStats, DataSourceStatus } from '../types';

const RETRYABLE_HTTP = new Set([502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient proxy/upstream failures while API boots (dev) or cold-starts. */
export async function fetchApiWithRetry(
  path: string,
  init?: RequestInit,
  maxAttempts = 6
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(path, init);
      if (res.ok) return res;
      if (RETRYABLE_HTTP.has(res.status) && attempt < maxAttempts - 1) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`API error: ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Failed to fetch');
      const retryable =
        lastError.message === 'Failed to fetch' ||
        lastError.message.startsWith('API error: 5');
      if (retryable && attempt < maxAttempts - 1) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  throw lastError ?? new Error('Failed to fetch');
}

interface StatusResponse {
  sources: DataSourceStatus[];
  stream?: {
    enabled: boolean;
    connected: boolean;
    subscribed: number;
    lastTradeAt: string | null;
    message?: string;
  };
}

interface TerminalResponse {
  quotes: Record<string, StockQuote>;
  launches: Launch[];
  news: NewsItem[];
  marketStats: MarketStats;
  sources: DataSourceStatus[];
  fetchedAt: string;
}

function parseQuote(raw: StockQuote & { lastUpdated: string }): StockQuote {
  return {
    ...raw,
    lastUpdated: new Date(raw.lastUpdated),
  };
}

function parseLaunch(raw: Launch & { date: string }): Launch {
  return {
    ...raw,
    date: new Date(raw.date),
  };
}

function parseNews(raw: NewsItem & { timestamp: string }): NewsItem {
  return {
    ...raw,
    timestamp: new Date(raw.timestamp),
  };
}

async function fetchTerminal(): Promise<TerminalResponse> {
  const res = await fetchApiWithRetry('/api/terminal');
  return res.json() as Promise<TerminalResponse>;
}

export async function fetchApiStatus(): Promise<DataSourceStatus[]> {
  const res = await fetch('/api/status');
  if (!res.ok) return [];
  const data = (await res.json()) as StatusResponse;
  return data.sources;
}

export async function forceRefreshCache(): Promise<void> {
  await fetch('/api/refresh', { method: 'POST' });
}

export function computeMarketStats(
  quotes: Map<string, StockQuote>,
  base?: MarketStats | null
): MarketStats {
  const quoteList = Array.from(quotes.values());
  const totalMarketCap = quoteList.reduce((sum, q) => sum + (q.marketCap ?? 0), 0);
  const avgChangePercent =
    quoteList.length > 0
      ? quoteList.reduce((sum, q) => sum + q.changePercent, 0) / quoteList.length
      : 0;

  return {
    totalMarketCap,
    avgChangePercent,
    launchesYTD: base?.launchesYTD ?? 0,
    upcomingLaunches: base?.upcomingLaunches ?? 0,
    activeSatellites: base?.activeSatellites ?? '—',
    governmentSpending: base?.governmentSpending ?? '—',
  };
}

export async function refreshTerminalData(): Promise<{
  quotes: Map<string, StockQuote>;
  launches: Launch[];
  news: NewsItem[];
  marketStats: MarketStats;
  sources: DataSourceStatus[];
}> {
  const data = await fetchTerminal();

  const quotes = new Map<string, StockQuote>();
  for (const [symbol, raw] of Object.entries(data.quotes)) {
    quotes.set(symbol, parseQuote(raw as StockQuote & { lastUpdated: string }));
  }

  return {
    quotes,
    launches: data.launches.map((l) => parseLaunch(l as Launch & { date: string })),
    news: data.news.map((n) => parseNews(n as NewsItem & { timestamp: string })),
    marketStats: data.marketStats,
    sources: data.sources,
  };
}
