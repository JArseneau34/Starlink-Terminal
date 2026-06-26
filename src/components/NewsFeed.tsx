import { useState } from 'react';
import type { NewsItem } from '../types';
import { isRecentNewsItem } from '../data/newsWire';
import { formatTimeAgo, getChangeColor } from '../utils/format';

interface NewsFeedProps {
  news: NewsItem[];
  onSymbolClick: (symbol: string) => void;
  /** Highlight items from the last 24h (Recent wire tab). */
  emphasizeRecent?: boolean;
}

const categoryColors: Record<string, string> = {
  IPO: 'text-bbg-green',
  LAUNCH: 'text-bbg-green',
  CONTRACT: 'text-bbg-cyan',
  GOVT: 'text-bbg-amber',
  TECH: 'text-bbg-cyan',
  EARNINGS: 'text-bbg-white',
  LUNAR: 'text-bbg-amber-dim',
  TELECOM: 'text-bbg-green',
  NEWS: 'text-bbg-gray',
};

function formatSentiment(score: number): string {
  const sign = score >= 0 ? '+' : '';
  return `${sign}${score.toFixed(2)}`;
}

function NewsThumb({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="news-thumb"
    />
  );
}

export function NewsFeed({ news, onSymbolClick, emphasizeRecent = false }: NewsFeedProps) {
  if (news.length === 0) {
    return (
      <div className="p-4 text-bbg-gray text-center text-[11px]">
        Loading news wire…
      </div>
    );
  }

  return (
    <div className="divide-y divide-bbg-border/50">
      {news.map((item) => {
        const isFresh = emphasizeRecent && isRecentNewsItem(item);
        return (
        <article
          key={item.id}
          className={`news-item px-3 py-2.5${isFresh ? ' news-item-recent' : ''}`}
        >
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                {isFresh && (
                  <span className="news-recent-badge text-[8px] font-semibold tracking-[0.14em]">
                    NEW
                  </span>
                )}
                <span className={`text-[9px] font-semibold ${categoryColors[item.category] ?? 'text-bbg-gray'}`}>
                  {item.category}
                </span>
                {item.sentiment !== undefined && (
                  <span
                    className={`text-[9px] font-medium ${getChangeColor(item.sentiment)}`}
                    title="Sentiment score"
                  >
                    SNT {formatSentiment(item.sentiment)}
                  </span>
                )}
                <span className="text-bbg-gray text-[9px]">{formatTimeAgo(item.timestamp)}</span>
                <span className="text-bbg-gray text-[9px]">· {item.source}</span>
              </div>
              <p className="text-bbg-white text-[11px] leading-snug">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-bbg-cyan transition-colors"
                  >
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
              </p>
              {item.summary && (
                <p className="text-bbg-gray text-[10px] mt-1 line-clamp-2 leading-snug">
                  {item.summary}
                </p>
              )}
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {item.relatedSymbols.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => onSymbolClick(sym)}
                    className="text-[9px] text-bbg-amber hover:text-bbg-cyan cursor-pointer"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
            {item.imageUrl && (
              <NewsThumb url={item.imageUrl} alt="" />
            )}
          </div>
        </article>
        );
      })}
    </div>
  );
}
