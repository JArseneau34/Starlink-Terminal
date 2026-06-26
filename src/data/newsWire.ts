import type { NewsItem, SectorTab } from '../types';
import { NEWS_RECENT_BACKFILL, NEWS_RECENT_MIN } from '../config/news';
import { getCompanyBySymbol } from './companies';
import { isStarlinkNews } from './starlinkNews';

export type NewsWireTabId = 'recent' | 'space' | 'starlink';

export const NEWS_WIRE_TABS: {
  id: NewsWireTabId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'recent', label: 'Recent & Updates', shortLabel: 'RECENT' },
  { id: 'space', label: 'Space Sector', shortLabel: 'SPACE' },
  { id: 'starlink', label: 'Starlink', shortLabel: 'STARLINK' },
];

const SPACE_SECTOR_TABS: SectorTab[] = [
  'launch',
  'satcom',
  'earth-obs',
  'defense',
  'infrastructure',
  'tourism',
];

export function getNewsWireTabLabel(id: NewsWireTabId): string {
  return NEWS_WIRE_TABS.find((t) => t.id === id)?.label ?? id;
}

export function isSpaceSectorNews(item: NewsItem): boolean {
  if (isStarlinkNews(item)) return false;
  if (item.sectorTab && SPACE_SECTOR_TABS.includes(item.sectorTab)) return true;
  if (item.relatedSymbols.length === 0) return true;
  return item.relatedSymbols.some((symbol) => {
    const company = getCompanyBySymbol(symbol);
    if (!company) return false;
    return company.sectorTab !== 'commodities' && company.sectorTab !== 'ai';
  });
}

/** Latest headlines — prefer last 72h, backfill to keep the wire populated. */
export function filterRecentNews(news: NewsItem[], minCount = NEWS_RECENT_MIN): NewsItem[] {
  const sorted = [...news].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const cutoff = Date.now() - 72 * 3_600_000;
  const recent = sorted.filter((item) => new Date(item.timestamp).getTime() >= cutoff);
  if (recent.length >= minCount) return recent;
  return sorted.slice(0, Math.max(minCount, NEWS_RECENT_BACKFILL));
}

export function isRecentNewsItem(item: NewsItem, hours = 24): boolean {
  return Date.now() - new Date(item.timestamp).getTime() <= hours * 3_600_000;
}

export function filterNewsByWireTab(news: NewsItem[], tab: NewsWireTabId): NewsItem[] {
  switch (tab) {
    case 'recent':
      return filterRecentNews(news);
    case 'space':
      return news.filter(isSpaceSectorNews);
    case 'starlink':
      return news.filter(isStarlinkNews);
  }
}

export function countNewsByWireTab(news: NewsItem[], tab: NewsWireTabId): number {
  return filterNewsByWireTab(news, tab).length;
}
