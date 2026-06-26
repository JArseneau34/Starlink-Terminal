import { FINNHUB_API_KEY } from '../config.js';
import type { StockQuote } from '../types.js';
import {
  isSimulatedQuoteSymbol,
  resolveQuoteSymbol,
} from '../../src/data/tickerRegistry.ts';

interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

async function fetchJson<T>(url: string, timeout = 8_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFinnhubQuoteOnly(displaySymbol: string): Promise<StockQuote | null> {
  if (!FINNHUB_API_KEY || isSimulatedQuoteSymbol(displaySymbol)) return null;

  const quoteSymbol = resolveQuoteSymbol(displaySymbol);
  const quote = await fetchJson<FinnhubQuote>(
    `https://finnhub.io/api/v1/quote?symbol=${quoteSymbol}&token=${FINNHUB_API_KEY}`
  );

  if (!quote?.c) return null;

  return {
    symbol: displaySymbol,
    price: quote.c,
    change: quote.d ?? quote.c - quote.pc,
    changePercent: quote.dp ?? 0,
    volume: 0,
    marketCap: undefined,
    high: quote.h ?? quote.c,
    low: quote.l ?? quote.c,
    open: quote.o ?? quote.c,
    previousClose: quote.pc ?? quote.c,
    lastUpdated: new Date(quote.t ? quote.t * 1000 : Date.now()).toISOString(),
    source: 'finnhub',
  };
}
