import { QUOTE_REFRESH_MS } from '../config.js';

export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

export interface TradingPeriodWindow {
  start: number;
  end: number;
}

export interface TradingPeriods {
  pre?: TradingPeriodWindow;
  regular?: TradingPeriodWindow;
  post?: TradingPeriodWindow;
}

const ET = 'America/New_York';

function etParts(date = new Date()): { hour: number; minute: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    day: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** US equities session from Eastern Time (weekday approximation — holidays not modeled). */
export function getMarketSessionET(now = new Date()): MarketSession {
  const { hour, minute, weekday } = etParts(now);
  if (weekday === 0 || weekday === 6) return 'closed';

  const mins = minutesSinceMidnight(hour, minute);
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'pre';
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'regular';
  if (mins >= 16 * 60 && mins < 20 * 60) return 'post';
  return 'closed';
}

export function getSessionFromTradingPeriod(
  period: TradingPeriods | undefined,
  nowSec = Math.floor(Date.now() / 1000)
): MarketSession {
  if (!period) return getMarketSessionET();

  if (period.pre && nowSec >= period.pre.start && nowSec < period.pre.end) return 'pre';
  if (period.regular && nowSec >= period.regular.start && nowSec < period.regular.end) return 'regular';
  if (period.post && nowSec >= period.post.start && nowSec < period.post.end) return 'post';
  return 'closed';
}

export function isExtendedSession(session: MarketSession): boolean {
  return session === 'pre' || session === 'post';
}

export function getSessionPollIntervalMs(session: MarketSession): {
  yahooBatchMs: number;
  stalePollLimit: number;
} {
  const stalePollLimit =
    session === 'regular' ? 5 : session === 'pre' || session === 'post' ? 8 : 3;
  return { yahooBatchMs: QUOTE_REFRESH_MS, stalePollLimit };
}

export function sessionLabel(session: MarketSession | undefined): string {
  switch (session) {
    case 'pre':
      return 'PRE';
    case 'post':
      return 'AH';
    default:
      return '';
  }
}
