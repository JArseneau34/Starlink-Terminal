import 'dotenv/config';
import { QUOTE_REFRESH_MS as DEFAULT_QUOTE_REFRESH_MS } from '../src/config/quotes.ts';
import {
  NEWS_MERGE_LIMIT as DEFAULT_NEWS_MERGE_LIMIT,
  NEWS_SOURCE_LIMITS as DEFAULT_NEWS_SOURCE_LIMITS,
} from '../src/config/news.ts';
import { PUBLIC_SYMBOLS as CLIENT_PUBLIC_SYMBOLS } from '../src/data/companies.ts';

export const PORT = Number(process.env.PORT ?? 3002);

export const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? '';
export const LL2_API_KEY = process.env.LL2_API_KEY ?? '';
export const NASA_API_KEY = process.env.NASA_API_KEY ?? 'DEMO_KEY';

export const LL2_BASE = process.env.LL2_USE_DEV === 'true'
  ? 'https://lldev.thespacedevs.com/2.3.0'
  : 'https://ll.thespacedevs.com/2.3.0';

export const SNAPI_BASE = 'https://api.spaceflightnewsapi.net/v4';

export const PUBLIC_SYMBOLS = CLIENT_PUBLIC_SYMBOLS as readonly string[];

export const CACHE_TTL = {
  quotes: Number(process.env.CACHE_TTL_QUOTES ?? 15_000),
  launches: Number(process.env.CACHE_TTL_LAUNCHES ?? 300_000),
  news: Number(process.env.CACHE_TTL_NEWS ?? 180_000),
  stats: Number(process.env.CACHE_TTL_STATS ?? 3_600_000),
  terminal: Number(process.env.CACHE_TTL_TERMINAL ?? 20_000),
};

/** Unified quote refresh for Yahoo batch, Finnhub stale poll, and client poll */
export const QUOTE_REFRESH_MS = Number(process.env.QUOTE_REFRESH_MS ?? DEFAULT_QUOTE_REFRESH_MS);

export const YAHOO_BATCH_MS = QUOTE_REFRESH_MS;
export const TURBO_POLL_MS = QUOTE_REFRESH_MS;
export const TURBO_CLIENT_POLL_MS = QUOTE_REFRESH_MS;

/** Skip Finnhub REST if WS updated symbol within this window */
export const FINNHUB_STALE_MS = Number(process.env.FINNHUB_STALE_MS ?? 20_000);

/** Max Finnhub REST calls per minute (free tier = 60; leave headroom for news) */
export const FINNHUB_REST_BUDGET_PER_MIN = Number(process.env.FINNHUB_REST_BUDGET_PER_MIN ?? 45);

export const NEWS_MERGE_LIMIT = Number(process.env.NEWS_MERGE_LIMIT ?? DEFAULT_NEWS_MERGE_LIMIT);

export const NEWS_SOURCE_LIMITS = {
  snapi: {
    spaceNewsSites: Number(process.env.NEWS_SNAPI_SITES_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.spaceNewsSites),
    spacex: Number(process.env.NEWS_SNAPI_SPACEX_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.spacex),
    satellite: Number(process.env.NEWS_SNAPI_SATELLITE_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.satellite),
    rocket: Number(process.env.NEWS_SNAPI_ROCKET_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.rocket),
    starlink: Number(process.env.NEWS_SNAPI_STARLINK_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.starlink),
    nasa: Number(process.env.NEWS_SNAPI_NASA_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.snapi.nasa),
  },
  marketaux: Number(process.env.NEWS_MARKETAUX_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.marketaux),
  finnhubCompanyPerSymbol: Number(
    process.env.NEWS_FINNHUB_COMPANY_LIMIT ?? DEFAULT_NEWS_SOURCE_LIMITS.finnhubCompanyPerSymbol
  ),
};

/** Symbols for Finnhub company-news (avoid 36 parallel calls) */
export const PRIORITY_NEWS_SYMBOLS = [
  'RKLB', 'LMT', 'NOC', 'BA', 'PL', 'ASTS', 'IRDM', 'SPCE', 'VSAT', 'RTX', 'LHX', 'GSAT',
  'NVDA', 'MSFT', 'GOOGL', 'PLTR',
] as const;
