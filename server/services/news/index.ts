import type { DataSourceStatus, NewsItem } from '../../types.js';
import { NEWS_MERGE_LIMIT } from '../../config.js';
import { dedupeNews, sortNews } from './tagging.js';
import { fetchFinnhubNews } from './finnhubNews.js';
import { fetchSnapiNews } from './snapiNews.js';
import { fetchMarketauxNews } from './marketauxNews.js';

function isSpaceRelevant(item: NewsItem): boolean {
  const text = `${item.headline} ${item.summary ?? ''}`.toLowerCase();

  if (item.provider === 'snapi') return true;
  if (item.relatedSymbols.length > 0) return true;

  const strongSpace =
    /spacex|starlink|falcon|starship|rocket lab|satellite|orbit|nasa|artemis|starliner|constellation|lunar|geospatial|iridium|northrop|lockheed|boeing|space force|ussf|electron|neutron|rklb|asts|spce|planet labs|blacksky|satellogic|redwire|virgin galactic|blue origin|defense|missile|spacecraft|iss\b|crew dragon|cygnus|vulcan centaur/i;

  if (strongSpace.test(text)) return true;

  // "launch" alone matches non-space stories (e.g. product launches)
  if (/\blaunch\b/.test(text) && /\b(rocket|falcon|electron|starship|orbit|spacex|nasa)\b/i.test(text)) {
    return true;
  }

  return false;
}

export async function fetchNews(limit = NEWS_MERGE_LIMIT): Promise<{
  news: NewsItem[];
  status: DataSourceStatus;
  sources: DataSourceStatus[];
}> {
  const [finnhub, snapi, marketaux] = await Promise.all([
    fetchFinnhubNews(),
    fetchSnapiNews(),
    fetchMarketauxNews(),
  ]);

  const merged = dedupeNews(
    sortNews([...finnhub.articles, ...snapi.articles, ...marketaux.articles])
  )
    .filter(isSpaceRelevant)
    .slice(0, limit);

  const sourceStatuses: DataSourceStatus[] = [
    {
      name: 'Finnhub News',
      status: finnhub.articles.length > 0 ? 'ok' : finnhub.error ? 'degraded' : 'error',
      lastFetch: new Date().toISOString(),
      message: finnhub.articles.length
        ? `${finnhub.articles.length} articles (market + company)`
        : finnhub.error ?? 'Unavailable',
    },
    {
      name: 'Spaceflight News API',
      status: snapi.articles.length > 0 ? 'ok' : 'error',
      lastFetch: new Date().toISOString(),
      message: snapi.articles.length
        ? `${snapi.articles.length} articles (SpaceNews, Spaceflight Now)`
        : snapi.error ?? 'Unavailable',
    },
    {
      name: 'Marketaux',
      status: marketaux.articles.length > 0
        ? 'ok'
        : marketaux.error === 'No API key'
          ? 'seed'
          : 'error',
      lastFetch: new Date().toISOString(),
      message: marketaux.articles.length
        ? `${marketaux.articles.length} articles with sentiment`
        : marketaux.error === 'No API key'
          ? 'Optional — add MARKETAUX_API_KEY'
          : marketaux.error ?? 'Unavailable',
    },
  ];

  const activeCount = sourceStatuses.filter((s) => s.status === 'ok').length;

  return {
    news: merged,
    sources: sourceStatuses,
    status: {
      name: 'News Wire',
      status: merged.length > 0 ? (activeCount >= 2 ? 'ok' : 'degraded') : 'error',
      lastFetch: new Date().toISOString(),
      message: `${merged.length} merged · ${activeCount} sources live`,
    },
  };
}
