import { FINNHUB_API_KEY, PRIORITY_NEWS_SYMBOLS, NEWS_SOURCE_LIMITS } from '../../config.js';
import type { NewsItem } from '../../types.js';
import { tagArticle } from './tagging.js';
import { normalizeNewsImageUrl } from './images.js';

interface FinnhubArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related?: string;
  category?: string;
  image?: string;
}

async function fetchFinnhubJson<T>(url: string): Promise<T | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapFinnhubArticle(
  article: FinnhubArticle,
  idPrefix: string,
  explicitSymbol?: string
): NewsItem {
  const text = `${article.headline} ${article.summary ?? ''}`;
  const tags = tagArticle(text, explicitSymbol ?? article.related);

  return {
    id: `${idPrefix}-${article.id}`,
    headline: article.headline,
    source: `Finnhub · ${article.source}`,
    timestamp: new Date(article.datetime * 1000).toISOString(),
    url: article.url,
    summary: article.summary?.slice(0, 200),
    imageUrl: normalizeNewsImageUrl(article.image),
    provider: 'finnhub',
    ...tags,
  };
}

export async function fetchFinnhubNews(): Promise<{
  articles: NewsItem[];
  error?: string;
}> {
  if (!FINNHUB_API_KEY) {
    return { articles: [], error: 'No API key' };
  }

  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const [general, technology, ...companyResults] = await Promise.all([
    fetchFinnhubJson<FinnhubArticle[]>(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`
    ),
    fetchFinnhubJson<FinnhubArticle[]>(
      `https://finnhub.io/api/v1/news?category=technology&token=${FINNHUB_API_KEY}`
    ),
    ...PRIORITY_NEWS_SYMBOLS.map((symbol) =>
      fetchFinnhubJson<FinnhubArticle[]>(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`
      ).then((data) => ({ symbol, data }))
    ),
  ]);

  const articles: NewsItem[] = [];

  for (const item of general ?? []) {
    articles.push(mapFinnhubArticle(item, 'fh-mkt'));
  }
  for (const item of technology ?? []) {
    articles.push(mapFinnhubArticle(item, 'fh-tech'));
  }

  for (const result of companyResults) {
    if (!result?.data) continue;
    for (const item of result.data.slice(0, NEWS_SOURCE_LIMITS.finnhubCompanyPerSymbol)) {
      articles.push(mapFinnhubArticle(item, `fh-${result.symbol}`, result.symbol));
    }
  }

  return { articles };
}
