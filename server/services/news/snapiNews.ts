import { SNAPI_BASE, NEWS_SOURCE_LIMITS } from '../../config.js';
import type { NewsItem } from '../../types.js';
import { tagArticle } from './tagging.js';
import { normalizeNewsImageUrl } from './images.js';

interface SNAPIArticle {
  id: number;
  title: string;
  news_site: string;
  published_at: string;
  summary?: string;
  url: string;
  image_url?: string;
}

interface SNAPIResponse {
  results: SNAPIArticle[];
}

function mapSnapiArticle(a: SNAPIArticle): NewsItem {
  const tags = tagArticle(`${a.title} ${a.summary ?? ''}`);
  return {
    id: `snapi-${a.id}`,
    headline: a.title,
    source: a.news_site,
    timestamp: a.published_at,
    url: a.url,
    summary: a.summary?.slice(0, 200),
    imageUrl: normalizeNewsImageUrl(a.image_url),
    provider: 'snapi',
    ...tags,
  };
}

async function fetchSnapiUrl(url: string): Promise<SNAPIArticle[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as SNAPIResponse;
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function fetchSnapiNews(): Promise<{
  articles: NewsItem[];
  error?: string;
}> {
  const { snapi } = NEWS_SOURCE_LIMITS;
  const feeds = await Promise.all([
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.spaceNewsSites}&ordering=-published_at&news_site__in=SpaceNews,Spaceflight Now,NASASpaceflight`
    ),
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.spacex}&ordering=-published_at&search=spacex`
    ),
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.satellite}&ordering=-published_at&search=satellite`
    ),
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.rocket}&ordering=-published_at&search=rocket`
    ),
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.starlink}&ordering=-published_at&search=starlink`
    ),
    fetchSnapiUrl(
      `${SNAPI_BASE}/articles/?limit=${snapi.nasa}&ordering=-published_at&search=nasa`
    ),
  ]);

  const articles = feeds.flat().map(mapSnapiArticle);
  if (articles.length === 0) {
    return { articles: [], error: 'No articles returned' };
  }

  return { articles };
}
