import { useMemo, useState } from 'react';
import type { NewsItem } from '../types';
import { Panel } from './Panel';
import { SubTabs } from './SubTabs';
import { NewsFeed } from './NewsFeed';
import {
  filterNewsByWireTab,
  countNewsByWireTab,
  getNewsWireTabLabel,
  NEWS_WIRE_TABS,
  type NewsWireTabId,
} from '../data/newsWire';

interface NewsWireTabProps {
  news: NewsItem[];
  onSymbolClick: (symbol: string) => void;
}

const TAB_HINTS: Record<NewsWireTabId, string> = {
  recent: 'BREAKING · LAST 72H · CROSS-SECTOR',
  space: 'LAUNCH · SATCOM · EARTH OBS · DEFENSE · INFRA · TOURISM',
  starlink: 'CONSTELLATION · LAUNCHES · D2C · MARITIME · ENTERPRISE · PEERS',
};

export function NewsWireTab({ news, onSymbolClick }: NewsWireTabProps) {
  const [activeTab, setActiveTab] = useState<NewsWireTabId>('recent');

  const wireNews = useMemo(() => filterNewsByWireTab(news, activeTab), [news, activeTab]);

  const panelTitle = `News Wire — ${getNewsWireTabLabel(activeTab)}`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SubTabs<NewsWireTabId>
        active={activeTab}
        onChange={setActiveTab}
        tabs={NEWS_WIRE_TABS.map((tab) => ({
          id: tab.id,
          label: tab.shortLabel,
          count: countNewsByWireTab(news, tab.id),
        }))}
        headerRight={
          <span className="text-bbg-muted text-[9px] tracking-wider hidden sm:inline">
            {TAB_HINTS[activeTab]}
          </span>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 p-px terminal-grid">
        <Panel
          title={panelTitle}
          flex={1}
          className="flex-1 min-h-0"
          headerRight={
            <span className="text-bbg-muted text-[9px] tracking-wider tabular-nums">
              {wireNews.length} HEADLINES
            </span>
          }
        >
          {wireNews.length > 0 ? (
            <NewsFeed
              news={wireNews}
              onSymbolClick={onSymbolClick}
              emphasizeRecent={activeTab === 'recent'}
            />
          ) : (
            <div className="p-4 text-bbg-gray text-center text-[11px]">
              No headlines for {getNewsWireTabLabel(activeTab).toLowerCase()} in current wire
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
