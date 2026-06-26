import { FINNHUB_STALE_MS } from '../config.js';
import type { MarketSession, StockQuote } from '../types.js';
import { getMarketSessionET } from './marketHours.js';

const SOURCE_RANK: Record<string, number> = {
  'finnhub-ws': 5,
  'yahoo-extended': 4,
  'yahoo-batch': 4,
  yahoo: 4,
  'finnhub-turbo': 3,
  finnhub: 3,
  'spcx-model': 2,
  'spcx-sim': 2,
  seed: 0,
};

function ts(quote: StockQuote): number {
  return new Date(quote.lastUpdated).getTime();
}

function rank(source?: string): number {
  return SOURCE_RANK[source ?? ''] ?? 1;
}

function isWsFresh(quote: StockQuote): boolean {
  return quote.source === 'finnhub-ws' && Date.now() - ts(quote) < FINNHUB_STALE_MS;
}

/** Merge incoming quote into existing — WS wins when fresh; Yahoo enriches OHLCV. */
export function mergeStockQuote(
  existing: StockQuote | undefined,
  incoming: StockQuote
): StockQuote {
  if (!existing) return incoming;

  const wsFresh = isWsFresh(existing);
  const incomingWs = incoming.source === 'finnhub-ws';
  const incomingYahoo =
    incoming.source === 'yahoo-batch' ||
    incoming.source === 'yahoo' ||
    incoming.source === 'yahoo-extended';
  const incomingSim =
    incoming.source === 'spcx-model' || incoming.source === 'spcx-sim';

  const enriched = {
    volume:
      Math.max(incoming.volume ?? 0, existing.volume ?? 0) ||
      incoming.volume ||
      existing.volume,
    marketCap: incoming.marketCap ?? existing.marketCap,
    open: incoming.open || existing.open,
    high: incomingYahoo
      ? Math.max(existing.high, incoming.high)
      : Math.max(existing.high, incoming.high ?? existing.high),
    low: incomingYahoo
      ? Math.min(existing.low, incoming.low)
      : Math.min(existing.low, incoming.low ?? existing.low),
    previousClose: incoming.previousClose || existing.previousClose,
  };

  let price = existing.price;
  let change = existing.change;
  let changePercent = existing.changePercent;
  let lastUpdated = existing.lastUpdated;
  let source = existing.source;

  if (incomingSim || incomingWs) {
    price = incoming.price;
    change = incoming.change;
    changePercent = incoming.changePercent;
    lastUpdated = incoming.lastUpdated;
    source = incoming.source;
  } else if (!wsFresh) {
    const shouldTakePrice =
      existing.source === 'seed' ||
      rank(incoming.source) >= rank(existing.source) ||
      ts(incoming) >= ts(existing) ||
      incoming.price !== existing.price;

    if (shouldTakePrice && incoming.price > 0) {
      price = incoming.price;
      change = incoming.change;
      changePercent = incoming.changePercent;
      lastUpdated = incoming.lastUpdated;
      source = incoming.source;
    } else if (incomingYahoo) {
      // Refresh enrichment fields even when price unchanged
      lastUpdated = incoming.lastUpdated;
    }
  } else if (incomingYahoo) {
    // WS price is fresh — keep price, still merge enrichment above
  } else if (rank(incoming.source) >= rank(existing.source)) {
    price = incoming.price;
    change = incoming.change;
    changePercent = incoming.changePercent;
    lastUpdated = incoming.lastUpdated;
    source = incoming.source;
  }

  const previousClose = enriched.previousClose;
  if (!incomingWs && !incomingSim && !wsFresh) {
    change = price - previousClose;
    changePercent = previousClose ? (change / previousClose) * 100 : 0;
  }

  const session: MarketSession | undefined =
    incoming.session ?? existing.session ?? getMarketSessionET();
  const regularPrice = incoming.regularPrice ?? existing.regularPrice;
  const extendedPrice = incoming.extendedPrice ?? existing.extendedPrice;

  return {
    symbol: incoming.symbol,
    price,
    change,
    changePercent,
    ...enriched,
    previousClose,
    lastUpdated,
    source,
    session,
    regularPrice,
    extendedPrice,
  };
}

export function mergeQuoteMaps(
  base: Record<string, StockQuote>,
  incoming: Record<string, StockQuote>
): Record<string, StockQuote> {
  const out = { ...base };
  for (const [symbol, quote] of Object.entries(incoming)) {
    out[symbol] = mergeStockQuote(out[symbol], quote);
  }
  return out;
}

export function getMissingSymbols(
  expected: readonly string[],
  quotes: Record<string, StockQuote> | Map<string, StockQuote>
): string[] {
  const has = quotes instanceof Map
    ? (s: string) => quotes.has(s)
    : (s: string) => s in quotes;

  return expected.filter((s) => !has(s));
}
