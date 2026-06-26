import type { ReactNode } from 'react';

export interface SubTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface SubTabsProps<T extends string> {
  tabs: SubTabItem<T>[];
  active: T;
  onChange: (tab: T) => void;
  headerRight?: ReactNode;
}

export function SubTabs<T extends string>({ tabs, active, onChange, headerRight }: SubTabsProps<T>) {
  return (
    <nav className="subtab-nav flex items-stretch shrink-0 border-b border-bbg-border-subtle bg-[#08080d] overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`subtab-btn px-3 py-2 text-[9px] font-medium tracking-[0.12em] border-r border-bbg-border-subtle cursor-pointer whitespace-nowrap ${
              isActive
                ? 'subtab-btn-active'
                : 'text-bbg-muted hover:text-bbg-white hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 text-[8px] tabular-nums ${
                  isActive ? 'text-bbg-amber-dim' : 'text-bbg-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
      {headerRight && (
        <div className="flex items-center gap-2 px-3 ml-auto shrink-0">{headerRight}</div>
      )}
    </nav>
  );
}
