import { getCached, setCache, coalesceAsync } from '../cache.js';
import { CACHE_TTL } from '../config.js';
import { fetchLaunches } from './launches.js';
import { fetchNews } from './news/index.js';
import { fetchAllQuotes } from './quotes.js';
import { getQuoteSnapshot } from './quoteStream.js';
import { mergeQuoteMaps } from './quoteMerge.js';
import type { MarketStats, TerminalPayload } from '../types.js';

function computeMarketStats(
  quotes: Record<string, import('../types.js').StockQuote>,
  upcomingCount: number,
  ytdCount: number
): MarketStats {
  const quoteList = Object.values(quotes);
  const totalMarketCap = quoteList.reduce((sum, q) => sum + (q.marketCap ?? 0), 0);
  const avgChangePercent =
    quoteList.length > 0
      ? quoteList.reduce((sum, q) => sum + q.changePercent, 0) / quoteList.length
      : 0;

  return {
    totalMarketCap,
    avgChangePercent,
    launchesYTD: ytdCount,
    upcomingLaunches: upcomingCount,
    activeSatellites: '9,600+',
    governmentSpending: '$74.2B',
  };
}

export async function buildTerminalPayload(): Promise<TerminalPayload> {
  const cached = getCached<TerminalPayload>('terminal');
  if (cached) return cached;

  return coalesceAsync('terminal:build', () => buildTerminalPayloadFresh());
}

async function buildTerminalPayloadFresh(): Promise<TerminalPayload> {
  const cached = getCached<TerminalPayload>('terminal');
  if (cached) return cached;

  const [quotesResult, launchesResult, newsResult] = await Promise.all([
    (async () => {
      const c = getCached<Awaited<ReturnType<typeof fetchAllQuotes>>>('quotes');
      if (c) return { ...c, status: { ...c.status, status: 'cached' as const } };
      const result = await fetchAllQuotes();
      setCache('quotes', result, CACHE_TTL.quotes);
      return result;
    })(),
    (async () => {
      const c = getCached<Awaited<ReturnType<typeof fetchLaunches>>>('launches');
      if (c) return { ...c, status: { ...c.status, status: 'cached' as const } };
      const result = await fetchLaunches();
      setCache('launches', result, CACHE_TTL.launches);
      return result;
    })(),
    (async () => {
      const c = getCached<Awaited<ReturnType<typeof fetchNews>>>('news');
      if (c) {
        return {
          ...c,
          status: { ...c.status, status: 'cached' as const },
          sources: c.sources.map((s) => ({ ...s, status: 'cached' as const })),
        };
      }
      const result = await fetchNews();
      setCache('news', result, CACHE_TTL.news);
      return result;
    })(),
  ]);

  const payload: TerminalPayload = {
    quotes: mergeQuoteMaps(quotesResult.quotes, getQuoteSnapshot()),
    launches: launchesResult.launches,
    news: newsResult.news,
    marketStats: computeMarketStats(
      mergeQuoteMaps(quotesResult.quotes, getQuoteSnapshot()),
      launchesResult.upcomingCount,
      launchesResult.ytdCount
    ),
    sources: [
      quotesResult.status,
      launchesResult.status,
      newsResult.status,
      ...newsResult.sources,
    ],
    fetchedAt: new Date().toISOString(),
  };

  setCache('terminal', payload, CACHE_TTL.terminal);
  return payload;
}

export async function getApiStatus(): Promise<TerminalPayload['sources']> {
  const payload = await buildTerminalPayload();
  return payload.sources;
}
