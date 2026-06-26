/** Final merged article count served to the terminal. */
export const NEWS_MERGE_LIMIT = 100;

/** Per-source fetch limits (raw articles before dedupe). */
export const NEWS_SOURCE_LIMITS = {
  snapi: {
    spaceNewsSites: 40,
    spacex: 30,
    satellite: 25,
    rocket: 20,
    starlink: 20,
    nasa: 20,
  },
  marketaux: 50,
  finnhubCompanyPerSymbol: 8,
} as const;

/** Recent tab: minimum headlines and backfill cap. */
export const NEWS_RECENT_MIN = 24;
export const NEWS_RECENT_BACKFILL = 50;
