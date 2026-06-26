import { PUBLIC_SYMBOLS, NEWS_SOURCE_LIMITS } from '../../config.js';
import type { NewsItem } from '../../types.js';
import {
  isSimulatedQuoteSymbol,
  resolveQuoteSymbol,
} from '../../../src/data/tickerRegistry.ts';
import { tagArticle } from './tagging.js';
import { normalizeNewsImageUrl } from './images.js';

const MARKETAUX_API_KEY = process.env.MARKETAUX_API_KEY ?? '';

interface MarketauxArticle {
  uuid: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
  entities?: Array<{ symbol: string; sentiment_score?: number }>;
}

interface MarketauxResponse {
  data: MarketauxArticle[];
}

export async function fetchMarketauxNews(): Promise<{
  articles: NewsItem[];
  error?: string;
}> {
  if (!MARKETAUX_API_KEY) {
    return { articles: [], error: 'No API key' };
  }

  const symbols = PUBLIC_SYMBOLS.filter((s) => !isSimulatedQuoteSymbol(s))
    .map(resolveQuoteSymbol)
    .join(',');
  const url =
    `https://api.marketaux.com/v1/news/all?symbols=${symbols}` +
    `&filter_entities=true&language=en&limit=${NEWS_SOURCE_LIMITS.marketaux}&api_token=${MARKETAUX_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { articles: [], error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as MarketauxResponse;
    const articles: NewsItem[] = (data.data ?? []).map((a) => {
      const entitySymbols = a.entities?.map((e) => e.symbol) ?? [];
      const sentiment = a.entities?.[0]?.sentiment_score;
      const text = `${a.title} ${a.description ?? ''}`;
      const tags = tagArticle(text, entitySymbols[0]);

      return {
        id: `mkt-${a.uuid}`,
        headline: a.title,
        source: `Marketaux · ${a.source}`,
        timestamp: a.published_at,
        url: a.url,
        summary: a.description?.slice(0, 200),
        imageUrl: normalizeNewsImageUrl(a.image_url),
        sentiment,
        provider: 'marketaux',
        relatedSymbols: [
          ...new Set([...tags.relatedSymbols, ...entitySymbols]),
        ],
        category: tags.category,
        sectorTab: tags.sectorTab,
      };
    });

    return { articles };
  } catch {
    return { articles: [], error: 'Network error' };
  }
}
