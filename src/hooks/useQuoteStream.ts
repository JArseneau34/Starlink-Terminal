import { useEffect, useRef, useCallback, useState } from 'react';
import type { MarketSession, StockQuote, DataSourceStatus } from '../types';

export interface StreamStatus {
  enabled: boolean;
  connected: boolean;
  subscribed: number;
  lastTradeAt: string | null;
  turboPoll?: boolean;
  pollIntervalMs?: number;
  yahooBatchMs?: number;
  finnhubBudgetRemaining?: number;
  symbolsTracked?: number;
  symbolsExpected?: number;
  symbolsMissing?: string[];
  marketSession?: MarketSession;
  extendedHours?: boolean;
  message?: string;
}

interface WsSnapshot {
  type: 'snapshot';
  data: Record<string, StockQuote & { lastUpdated: string }>;
  stream: StreamStatus;
}

interface WsQuote {
  type: 'quote';
  data: StockQuote & { lastUpdated: string };
}

interface WsStatus {
  type: 'status';
  data: StreamStatus;
}

type WsMessage = WsSnapshot | WsQuote | WsStatus;

function parseQuote(raw: StockQuote & { lastUpdated: string }): StockQuote {
  return { ...raw, lastUpdated: new Date(raw.lastUpdated) };
}

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/quotes`;
}

export function useQuoteStream(
  onQuoteUpdate: (quote: StockQuote) => void,
  onSnapshot?: (quotes: Map<string, StockQuote>) => void
) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const onQuoteUpdateRef = useRef(onQuoteUpdate);
  const onSnapshotRef = useRef(onSnapshot);

  onQuoteUpdateRef.current = onQuoteUpdate;
  onSnapshotRef.current = onSnapshot;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setIsStreaming(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;

        if (msg.type === 'snapshot') {
          setStreamStatus(msg.stream);
          setIsStreaming(Boolean(msg.stream.turboPoll || msg.stream.connected));
          if (onSnapshotRef.current) {
            const map = new Map<string, StockQuote>();
            for (const [sym, raw] of Object.entries(msg.data)) {
              map.set(sym, parseQuote(raw));
            }
            onSnapshotRef.current(map);
          }
        } else if (msg.type === 'quote') {
          onQuoteUpdateRef.current(parseQuote(msg.data));
        } else if (msg.type === 'status') {
          setStreamStatus(msg.data);
          setIsStreaming(Boolean(msg.data.turboPoll || msg.data.connected));
        }
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      setIsStreaming(false);
      wsRef.current = null;
      const delay = Math.min(30_000, 1000 * 2 ** attemptRef.current);
      attemptRef.current++;
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const streamSource: DataSourceStatus | null = streamStatus
    ? {
        name: 'Quote Stream',
        status: streamStatus.connected || !streamStatus.enabled ? 'ok' : 'degraded',
        lastFetch: streamStatus.lastTradeAt,
        message: streamStatus.message,
      }
    : null;

  return { isStreaming, streamStatus, streamSource };
}
