import WebSocket from 'ws';
import {
  FINNHUB_API_KEY,
  PUBLIC_SYMBOLS,
  TURBO_POLL_MS,
  YAHOO_BATCH_MS,
  FINNHUB_STALE_MS,
  FINNHUB_REST_BUDGET_PER_MIN,
} from '../config.js';
import { isSimulatedQuoteSymbol } from '../../src/data/tickerRegistry.ts';
import { fetchFinnhubQuoteOnly } from './quotesFinnhub.js';
import { fetchAllQuotes } from './quotes.js';
import { fetchYahooQuotesBatch } from './yahooQuotes.js';
import { mergeStockQuote, getMissingSymbols } from './quoteMerge.js';
import {
  getMarketSessionET,
  getSessionPollIntervalMs,
  isExtendedSession,
  type MarketSession,
} from './marketHours.js';
import type { StockQuote } from '../types.js';

/** Tradable symbols streamed via Yahoo batch + optional Finnhub WS */
const STREAM_SYMBOLS = PUBLIC_SYMBOLS.filter((s) => !isSimulatedQuoteSymbol(s));

export interface StreamStatus {
  enabled: boolean;
  connected: boolean;
  subscribed: number;
  lastTradeAt: string | null;
  turboPoll: boolean;
  pollIntervalMs: number;
  yahooBatchMs: number;
  finnhubBudgetRemaining: number;
  symbolsTracked: number;
  symbolsExpected: number;
  symbolsMissing: string[];
  marketSession: MarketSession;
  extendedHours: boolean;
  message?: string;
}

interface FinnhubTrade {
  p: number;
  s: string;
  t: number;
  v: number;
}

interface FinnhubMessage {
  type: string;
  data?: FinnhubTrade[];
}

const quoteState = new Map<string, StockQuote>();
const clients = new Set<WebSocket>();
const finnhubCallTimestamps: number[] = [];

let finnhubWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let turboPollTimer: ReturnType<typeof setInterval> | null = null;
let yahooBatchTimer: ReturnType<typeof setInterval> | null = null;
let sessionTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempt = 0;
let lastTradeAt: string | null = null;
let activeYahooBatchMs = YAHOO_BATCH_MS;
let activeStalePollLimit = 5;

function finnhubBudgetRemaining(): number {
  const cutoff = Date.now() - 60_000;
  while (finnhubCallTimestamps.length > 0 && finnhubCallTimestamps[0]! < cutoff) {
    finnhubCallTimestamps.shift();
  }
  return Math.max(0, FINNHUB_REST_BUDGET_PER_MIN - finnhubCallTimestamps.length);
}

function recordFinnhubCall(): boolean {
  if (finnhubBudgetRemaining() <= 0) return false;
  finnhubCallTimestamps.push(Date.now());
  return true;
}

let streamStatus: StreamStatus = {
  enabled: Boolean(FINNHUB_API_KEY),
  connected: false,
  subscribed: 0,
  lastTradeAt: null,
  turboPoll: false,
  pollIntervalMs: TURBO_POLL_MS,
  yahooBatchMs: YAHOO_BATCH_MS,
  finnhubBudgetRemaining: FINNHUB_REST_BUDGET_PER_MIN,
  symbolsTracked: 0,
  symbolsExpected: PUBLIC_SYMBOLS.length,
  symbolsMissing: [],
  marketSession: getMarketSessionET(),
  extendedHours: isExtendedSession(getMarketSessionET()),
  message: FINNHUB_API_KEY
    ? 'Initializing…'
    : 'Yahoo batch mode — add FINNHUB_API_KEY for trade stream',
};

function updateCoverageStatus(): void {
  const missing = getMissingSymbols([...PUBLIC_SYMBOLS], quoteState);
  streamStatus = {
    ...streamStatus,
    symbolsTracked: quoteState.size,
    symbolsExpected: PUBLIC_SYMBOLS.length,
    symbolsMissing: missing,
    finnhubBudgetRemaining: finnhubBudgetRemaining(),
  };
}

function refreshStatusMessage(): void {
  updateCoverageStatus();
  const session = getMarketSessionET();
  const parts: string[] = [];
  if (FINNHUB_API_KEY) {
    parts.push(streamStatus.connected ? 'Finnhub WS' : 'Finnhub REST');
  }
  if (isExtendedSession(session)) {
    parts.push(session === 'pre' ? 'Pre-market' : 'After-hours');
  }
  parts.push(`Yahoo ${activeYahooBatchMs / 1000}s`);
  parts.push(`${streamStatus.symbolsTracked}/${streamStatus.symbolsExpected} symbols`);
  if (streamStatus.symbolsMissing.length > 0) {
    parts.push(`${streamStatus.symbolsMissing.length} missing`);
  }
  streamStatus = {
    ...streamStatus,
    marketSession: session,
    extendedHours: isExtendedSession(session),
    yahooBatchMs: activeYahooBatchMs,
    message: parts.join(' · '),
  };
}

export function getStreamStatus(): StreamStatus {
  refreshStatusMessage();
  return { ...streamStatus, lastTradeAt };
}

export function getQuoteSnapshot(): Record<string, StockQuote> {
  return Object.fromEntries(quoteState);
}

export function syncQuoteState(quotes: Record<string, StockQuote>): void {
  for (const [symbol, quote] of Object.entries(quotes)) {
    applyQuote(symbol, quote, false);
  }
}

function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function applyQuote(symbol: string, incoming: StockQuote, notify: boolean): StockQuote {
  const merged = mergeStockQuote(quoteState.get(symbol), incoming);
  quoteState.set(symbol, merged);
  lastTradeAt = merged.lastUpdated;
  if (notify) {
    broadcast({ type: 'quote', data: merged });
  }
  return merged;
}

function mergeAndBroadcast(symbol: string, patch: Partial<StockQuote>, source: string): void {
  const existing = quoteState.get(symbol);
  const previousClose = patch.previousClose ?? existing?.previousClose ?? patch.price ?? 0;
  const price = patch.price ?? existing?.price ?? 0;
  const session = patch.session ?? existing?.session ?? getMarketSessionET();

  applyQuote(
    symbol,
    {
      symbol,
      price,
      change: patch.change ?? price - previousClose,
      changePercent:
        patch.changePercent ??
        (previousClose ? ((price - previousClose) / previousClose) * 100 : 0),
      volume: patch.volume ?? existing?.volume ?? 0,
      marketCap: patch.marketCap ?? existing?.marketCap,
      high: Math.max(existing?.high ?? price, patch.high ?? price),
      low: Math.min(existing?.low ?? price, patch.low ?? price),
      open: patch.open ?? existing?.open ?? price,
      previousClose,
      lastUpdated: patch.lastUpdated ?? new Date().toISOString(),
      source,
      session,
      regularPrice: patch.regularPrice ?? existing?.regularPrice,
      extendedPrice: patch.extendedPrice ?? existing?.extendedPrice,
    },
    true
  );
}

function updateQuoteFromTrade(trade: FinnhubTrade): void {
  const existing = quoteState.get(trade.s);
  const previousClose = existing?.previousClose || trade.p;
  const price = trade.p;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  const session = getMarketSessionET();

  const base: StockQuote = existing ?? {
    symbol: trade.s,
    price,
    change,
    changePercent,
    volume: 0,
    high: price,
    low: price,
    open: price,
    previousClose,
    lastUpdated: new Date().toISOString(),
    source: 'finnhub-ws',
    session,
  };

  mergeAndBroadcast(
    trade.s,
    {
      price,
      change,
      changePercent,
      volume: (existing?.volume ?? 0) + (trade.v ?? 0),
      high: Math.max(base.high, price),
      low: Math.min(base.low, price),
      lastUpdated: new Date(trade.t).toISOString(),
      session,
      extendedPrice: isExtendedSession(session) ? price : existing?.extendedPrice,
      regularPrice: existing?.regularPrice,
    },
    'finnhub-ws'
  );
}

function sendSnapshot(client: WebSocket): void {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(
    JSON.stringify({
      type: 'snapshot',
      data: Object.fromEntries(quoteState),
      stream: getStreamStatus(),
    })
  );
}

export function registerClient(client: WebSocket): void {
  clients.add(client);
  sendSnapshot(client);

  client.on('close', () => clients.delete(client));
  client.on('error', () => clients.delete(client));
}

function subscribeAll(): void {
  if (!finnhubWs || finnhubWs.readyState !== WebSocket.OPEN) return;

  for (const symbol of STREAM_SYMBOLS) {
    finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
  }

  streamStatus = {
    ...streamStatus,
    connected: true,
    subscribed: STREAM_SYMBOLS.length,
  };
  refreshStatusMessage();
  broadcast({ type: 'status', data: getStreamStatus() });
}

function getStalestSymbols(limit: number): string[] {
  const now = Date.now();
  return [...STREAM_SYMBOLS]
    .map((symbol) => {
      const q = quoteState.get(symbol);
      const age = q ? now - new Date(q.lastUpdated).getTime() : Infinity;
      const wsFresh = q?.source === 'finnhub-ws' && age < FINNHUB_STALE_MS;
      return { symbol, age, wsFresh };
    })
    .filter((x) => !x.wsFresh)
    .sort((a, b) => b.age - a.age)
    .slice(0, limit)
    .map((x) => x.symbol);
}

async function pollYahooBatch(): Promise<void> {
  const batch = await fetchYahooQuotesBatch(STREAM_SYMBOLS);

  for (const quote of Object.values(batch)) {
    quote.source = quote.session === 'regular' ? 'yahoo-batch' : 'yahoo-extended';
    const before = quoteState.get(quote.symbol);
    const merged = applyQuote(quote.symbol, quote, false);
    if (
      !before ||
      before.price !== merged.price ||
      before.volume !== merged.volume ||
      before.change !== merged.change ||
      before.session !== merged.session
    ) {
      broadcast({ type: 'quote', data: merged });
    }
  }

  const missing = STREAM_SYMBOLS.filter((s) => !batch[s] && !quoteState.has(s));
  for (const symbol of missing.slice(0, 3)) {
    if (!FINNHUB_API_KEY || !recordFinnhubCall()) break;
    const fresh = await fetchFinnhubQuoteOnly(symbol);
    if (fresh) {
      applyQuote(symbol, { ...fresh, source: 'finnhub-turbo' }, true);
    }
  }

  updateCoverageStatus();
}

async function pollStaleFinnhub(): Promise<void> {
  if (!FINNHUB_API_KEY) return;

  const stale = getStalestSymbols(activeStalePollLimit);
  for (const symbol of stale) {
    if (!recordFinnhubCall()) break;

    const fresh = await fetchFinnhubQuoteOnly(symbol);
    if (!fresh) continue;

    const existing = quoteState.get(symbol);
    if (!existing || fresh.price !== existing.price || fresh.change !== existing.change) {
      const session = getMarketSessionET();
      mergeAndBroadcast(
        symbol,
        {
          price: fresh.price,
          change: fresh.change,
          changePercent: fresh.changePercent,
          open: fresh.open,
          high: fresh.high,
          low: fresh.low,
          previousClose: fresh.previousClose,
          lastUpdated: fresh.lastUpdated,
          session,
          extendedPrice: isExtendedSession(session) ? fresh.price : existing?.extendedPrice,
          regularPrice: existing?.regularPrice,
        },
        'finnhub-turbo'
      );
    }
  }
}

function applySessionPolling(): void {
  const session = getMarketSessionET();
  const { yahooBatchMs, stalePollLimit } = getSessionPollIntervalMs(session);

  activeYahooBatchMs = yahooBatchMs;
  activeStalePollLimit = stalePollLimit;

  if (yahooBatchTimer) clearInterval(yahooBatchTimer);
  yahooBatchTimer = setInterval(() => {
    pollYahooBatch().catch(() => {});
  }, activeYahooBatchMs);

  streamStatus = {
    ...streamStatus,
    marketSession: session,
    extendedHours: isExtendedSession(session),
    yahooBatchMs: activeYahooBatchMs,
  };
  refreshStatusMessage();
  broadcast({ type: 'status', data: getStreamStatus() });
}

function startPollers(): void {
  if (yahooBatchTimer) clearInterval(yahooBatchTimer);
  if (turboPollTimer) clearInterval(turboPollTimer);
  if (sessionTimer) clearInterval(sessionTimer);

  applySessionPolling();
  pollYahooBatch().catch(() => {});

  if (FINNHUB_API_KEY) {
    turboPollTimer = setInterval(() => {
      pollStaleFinnhub().catch(() => {});
    }, TURBO_POLL_MS);
  }

  sessionTimer = setInterval(applySessionPolling, 60_000);

  streamStatus = {
    ...streamStatus,
    turboPoll: true,
    pollIntervalMs: TURBO_POLL_MS,
  };
  refreshStatusMessage();
  broadcast({ type: 'status', data: getStreamStatus() });
}

function scheduleReconnect(): void {
  if (!FINNHUB_API_KEY) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  reconnectAttempt++;

  streamStatus = {
    ...streamStatus,
    connected: false,
    message: `WS reconnect ${Math.round(delay / 1000)}s · Yahoo batch active`,
  };
  broadcast({ type: 'status', data: getStreamStatus() });

  reconnectTimer = setTimeout(() => connectFinnhub(), delay);
}

function connectFinnhub(): void {
  if (!FINNHUB_API_KEY) return;

  if (finnhubWs) {
    finnhubWs.removeAllListeners();
    if (finnhubWs.readyState === WebSocket.OPEN) finnhubWs.close();
  }

  finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`);

  finnhubWs.on('open', () => {
    reconnectAttempt = 0;
    subscribeAll();
    console.log(`Finnhub WS connected — ${STREAM_SYMBOLS.length} symbols`);
  });

  finnhubWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as FinnhubMessage;

      if (msg.type === 'ping') {
        finnhubWs?.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'trade' && msg.data?.length) {
        for (const trade of msg.data) {
          updateQuoteFromTrade(trade);
        }
        streamStatus = { ...streamStatus, lastTradeAt, connected: true };
      }
    } catch {
      /* ignore malformed frames */
    }
  });

  finnhubWs.on('close', () => {
    streamStatus = { ...streamStatus, connected: false };
    refreshStatusMessage();
    broadcast({ type: 'status', data: getStreamStatus() });
    scheduleReconnect();
  });

  finnhubWs.on('error', () => {
    finnhubWs?.close();
  });
}

export async function bootstrapQuoteStream(): Promise<void> {
  const { quotes } = await fetchAllQuotes();
  syncQuoteState(quotes);

  if (!FINNHUB_API_KEY) {
    streamStatus = {
      enabled: false,
      connected: false,
      subscribed: 0,
      lastTradeAt: null,
      turboPoll: true,
      pollIntervalMs: TURBO_POLL_MS,
      yahooBatchMs: YAHOO_BATCH_MS,
      finnhubBudgetRemaining: 0,
      symbolsTracked: 0,
      symbolsExpected: PUBLIC_SYMBOLS.length,
      symbolsMissing: [],
      marketSession: getMarketSessionET(),
      extendedHours: isExtendedSession(getMarketSessionET()),
      message: `Yahoo batch every ${YAHOO_BATCH_MS / 1000}s · add FINNHUB_API_KEY for WS trades`,
    };
    startPollers();
    return;
  }

  streamStatus = {
    enabled: true,
    connected: false,
    subscribed: 0,
    lastTradeAt: null,
    turboPoll: false,
    pollIntervalMs: TURBO_POLL_MS,
    yahooBatchMs: YAHOO_BATCH_MS,
    finnhubBudgetRemaining: FINNHUB_REST_BUDGET_PER_MIN,
    symbolsTracked: 0,
    symbolsExpected: PUBLIC_SYMBOLS.length,
    symbolsMissing: [],
    marketSession: getMarketSessionET(),
    extendedHours: isExtendedSession(getMarketSessionET()),
    message: 'Connecting…',
  };

  connectFinnhub();
  startPollers();
}

export function stopQuoteStream(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (turboPollTimer) clearInterval(turboPollTimer);
  if (yahooBatchTimer) clearInterval(yahooBatchTimer);
  if (sessionTimer) clearInterval(sessionTimer);
  finnhubWs?.close();
  finnhubWs = null;
}
