import { FINNHUB_API_KEY, PUBLIC_SYMBOLS } from '../config.js';
import type { DataSourceStatus, StockQuote } from '../types.js';
import { fetchFinnhubQuoteOnly } from './quotesFinnhub.js';
import { fetchYahooQuotesBatch } from './yahooQuotes.js';

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const yahoo = await fetchYahooQuotesBatch([symbol]);
  if (yahoo[symbol]) return yahoo[symbol]!;

  if (FINNHUB_API_KEY) {
    const finnhub = await fetchFinnhubQuoteOnly(symbol);
    if (finnhub) return finnhub;
  }

  return null;
}

/** Bootstrap: Yahoo batch (1–2 calls) + Finnhub gap-fill for missing symbols. */
export async function fetchAllQuotes(): Promise<{
  quotes: Record<string, StockQuote>;
  status: DataSourceStatus;
}> {
  let quotes = await fetchYahooQuotesBatch([...PUBLIC_SYMBOLS]);

  for (const q of Object.values(quotes)) {
    q.source = 'yahoo-batch';
  }

  const missing = PUBLIC_SYMBOLS.filter((s) => !quotes[s]);
  if (FINNHUB_API_KEY && missing.length > 0) {
    const filled = await mapWithConcurrency(missing, 5, fetchFinnhubQuoteOnly);
    for (const q of filled) {
      if (q) quotes[q.symbol] = q;
    }
  }

  const sources = new Set(Object.values(quotes).map((q) => q.source));
  const yahooCount = Object.values(quotes).filter(
    (q) => q.source === 'yahoo' || q.source === 'yahoo-batch'
  ).length;
  const onlySeed = sources.size === 1 && sources.has('seed');

  return {
    quotes,
    status: {
      name: 'Stock Quotes',
      status: onlySeed ? 'seed' : yahooCount > 0 ? 'ok' : 'degraded',
      lastFetch: new Date().toISOString(),
      message: FINNHUB_API_KEY
        ? `Yahoo batch + Finnhub WS/REST · ${Object.keys(quotes).length}/${PUBLIC_SYMBOLS.length} symbols`
        : `Yahoo batch (free) · ${yahooCount}/${PUBLIC_SYMBOLS.length} · add FINNHUB_API_KEY for WS`,
    },
  };
}

export { fetchFinnhubQuoteOnly } from './quotesFinnhub.js';
