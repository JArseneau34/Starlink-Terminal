export type TerminalTab =
  | 'spcx-stats'
  | 'news-wire'
  | 'orbital-ops'
  | 'launch-manifest';

interface TerminalTabsProps {
  activeTab: TerminalTab;
  onTabChange: (tab: TerminalTab) => void;
  launchCount?: number;
  newsCount?: number;
}

const TABS: { id: TerminalTab; label: string; getCount?: (props: TerminalTabsProps) => number | undefined }[] = [
  { id: 'spcx-stats', label: 'SPCX STATISTICS' },
  { id: 'news-wire', label: 'NEWS WIRE', getCount: (p) => p.newsCount },
  { id: 'orbital-ops', label: 'ORBITAL OPS' },
  { id: 'launch-manifest', label: 'LAUNCH MANIFEST', getCount: (p) => p.launchCount },
];

const TAB_HINTS: Record<TerminalTab, string> = {
  'spcx-stats': 'EQUITY · OPERATIONS · MILESTONES · LAUNCHES',
  'news-wire': 'RECENT · SPACE SECTOR · STARLINK',
  'orbital-ops': 'LEO DOMAIN · STARLINK INVESTOR · FLEET · DEPLOYMENTS · SSA',
  'launch-manifest': 'DEPARTURES · LAUNCH SITES · $/KG · PAD CONTENTION · VEHICLES',
};

export function TerminalTabs({
  activeTab,
  onTabChange,
  launchCount,
  newsCount,
}: TerminalTabsProps) {
  const tabProps = { activeTab, onTabChange, launchCount, newsCount };

  return (
    <nav className="terminal-chrome flex items-stretch shrink-0 overflow-x-auto border-b border-bbg-border-subtle">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = tab.getCount?.(tabProps);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`tab-btn px-4 py-2 text-[10px] font-medium tracking-[0.14em] border-r border-bbg-border-subtle cursor-pointer ${
              isActive ? 'tab-btn-active' : 'text-bbg-muted hover:text-bbg-white hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
            {count !== undefined && (
              <span
                className={`ml-2 text-[9px] tabular-nums ${
                  isActive ? 'text-bbg-amber-dim' : 'text-bbg-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
      <div className="flex items-center px-4 text-[9px] text-bbg-muted tracking-[0.12em] shrink-0 ml-auto">
        {TAB_HINTS[activeTab]}
      </div>
    </nav>
  );
}
