import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  flex?: number;
}

export function Panel({ title, children, className = '', headerRight, flex }: PanelProps) {
  return (
    <div
      className={`panel-surface flex flex-col min-h-0 ${className}`}
      style={flex ? { flex } : undefined}
    >
      <div className="panel-header flex items-center justify-between px-3 py-1.5 shrink-0">
        <span className="panel-title">{title}</span>
        {headerRight}
      </div>
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  );
}
