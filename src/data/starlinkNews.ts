import type { NewsItem } from '../types';

/** Headlines explicitly about Starlink, Starshield, or direct LEO broadband competition. */
export const STARLINK_NEWS_PATTERN =
  /starlink|starshield|direct-to-cell|\bd2c\b|v2 mini|starlink mini|starlink terminal|starlink dish|starlink maritime|starlink aviation|starlink enterprise|starlink roam|starlink residential|starlink constellation|starlink gateway|starlink user terminal|leo broadband|low earth orbit broadband/i;

/** SpaceX launch / deployment stories tied to Starlink payloads. */
export const STARLINK_SPACEX_PATTERN =
  /spacex.*starlink|starlink.*(?:launch|mission|deployment|satellite|batch|shell|payload|group)|falcon.*starlink|starlink.*falcon/i;

/** Peer LEO broadband operators when framed as competitive / market context. */
export const STARLINK_PEER_PATTERN =
  /project kuiper|amazon kuiper|\bkuiper\b.*(?:satellite|broadband|constellation)|oneweb|telesat lightspeed|eutelsat oneweb|ast spacemobile.*(?:cell|broadband|connectivity)/i;

export function isStarlinkNews(item: NewsItem): boolean {
  const text = `${item.headline} ${item.summary ?? ''} ${item.category ?? ''}`;

  if (STARLINK_NEWS_PATTERN.test(text)) return true;
  if (STARLINK_SPACEX_PATTERN.test(text)) return true;
  if (STARLINK_PEER_PATTERN.test(text)) return true;

  if (item.relatedSymbols.includes('SPCX') && /starlink|starshield|satellite constellation/i.test(text)) {
    return true;
  }

  return false;
}

export function filterStarlinkNews(news: NewsItem[]): NewsItem[] {
  return news.filter(isStarlinkNews);
}
