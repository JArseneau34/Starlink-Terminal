import type { MarketSession, StockQuote } from '../types.js';
import {
  isSimulatedQuoteSymbol,
  resolveQuoteSymbol,
} from '../../src/data/tickerRegistry.ts';
import {
  getSessionFromTradingPeriod,
  type TradingPeriods,
} from './marketHours.js';

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_CONCURRENCY = 12;

interface YahooChartMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  marketCap?: number;
  currentTradingPeriod?: TradingPeriods;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: (number | null)[] }> };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string };
  };
}

function lastCloseInRange(
  timestamps: number[],
  closes: (number | null)[],
  start: number,
  end: number
): number | null {
  for (let i = timestamps.length - 1; i >= 0; i--) {
    const t = timestamps[i]!;
    const close = closes[i];
    if (t >= start && t < end && close != null) return close;
  }
  return null;
}

function resolveExtendedPrice(
  session: MarketSession,
  meta: YahooChartMeta,
  timestamps: number[],
  closes: (number | null)[]
): number | undefined {
  const period = meta.currentTradingPeriod;
  if (!period) {
    if (session === 'pre' && meta.preMarketPrice) return meta.preMarketPrice;
    if (session === 'post' && meta.postMarketPrice) return meta.postMarketPrice;
    return undefined;
  }

  if (session === 'pre') {
    return (
      meta.preMarketPrice ??
      (period.pre ? lastCloseInRange(timestamps, closes, period.pre.start, period.pre.end) : null) ??
      undefined
    );
  }

  if (session === 'post') {
    return (
      meta.postMarketPrice ??
      (period.post ? lastCloseInRange(timestamps, closes, period.post.start, period.post.end) : null) ??
      undefined
    );
  }

  if (session === 'closed' && period.post) {
    const lastPost = lastCloseInRange(timestamps, closes, period.post.start, period.post.end);
    if (lastPost != null) return lastPost;
  }

  return undefined;
}

function buildQuoteFromChart(symbol: string, result: YahooChartResult): StockQuote | null {
  const meta = result.meta;
  if (!meta?.regularMarketPrice) return null;

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const nowSec = Math.floor(Date.now() / 1000);
  const period = meta.currentTradingPeriod;

  let session = getSessionFromTradingPeriod(period, nowSec);
  const regularPrice = meta.regularMarketPrice;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? regularPrice;
  let extendedPrice = resolveExtendedPrice(session, meta, timestamps, closes);

  if (session === 'closed' && extendedPrice != null && period?.post && nowSec >= period.post.start) {
    session = 'post';
  }

  const displayPrice =
    session === 'pre' || session === 'post'
      ? extendedPrice ?? regularPrice
      : session === 'closed' && extendedPrice != null
        ? extendedPrice
        : regularPrice;

  const change = displayPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
    symbol,
    price: displayPrice,
    change,
    changePercent,
    volume: meta.regularMarketVolume ?? 0,
    marketCap: meta.marketCap,
    high: meta.regularMarketDayHigh ?? displayPrice,
    low: meta.regularMarketDayLow ?? displayPrice,
    open: meta.regularMarketOpen ?? displayPrice,
    previousClose,
    lastUpdated: new Date().toISOString(),
    source: session === 'regular' ? 'yahoo' : 'yahoo-extended',
    session,
    regularPrice,
    extendedPrice: extendedPrice ?? undefined,
  };
}

async function fetchYahooChart(symbol: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': YAHOO_UA,
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    if (!result) return null;

    return buildQuoteFromChart(symbol, result);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
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

/** Fetch symbols via Yahoo v8 chart API (parallel, no API key). */
export async function fetchYahooQuotesBatch(
  symbols: string[]
): Promise<Record<string, StockQuote>> {
  const unique = [...new Set(symbols.filter((s) => !isSimulatedQuoteSymbol(s)))];
  if (unique.length === 0) return {};

  const fetched = await mapWithConcurrency(unique, FETCH_CONCURRENCY, async (displaySymbol) => {
    const quoteSymbol = resolveQuoteSymbol(displaySymbol);
    const quote = await fetchYahooChart(quoteSymbol);
    if (!quote) return null;
    return { ...quote, symbol: displaySymbol };
  });

  const quotes: Record<string, StockQuote> = {};

  for (const quote of fetched) {
    if (quote) quotes[quote.symbol] = quote;
  }

  return quotes;
}

export async function fetchYahooQuote(symbol: string): Promise<StockQuote | null> {
  if (isSimulatedQuoteSymbol(symbol)) return null;
  const quote = await fetchYahooChart(resolveQuoteSymbol(symbol));
  if (!quote) return null;
  return { ...quote, symbol };
}
