import { useState, useEffect } from 'react';
import { SettingsButton } from './SettingsPanel';
import type { MarketSession } from '../types';
import { marketSessionTitle } from '../utils/marketSession';

interface HeaderProps {
  lastRefresh: Date | null;
  isLoading: boolean;
  isStreaming?: boolean;
  marketSession?: MarketSession;
  extendedHours?: boolean;
  onOpenSettings: () => void;
}

export function Header({ lastRefresh, isLoading, isStreaming, marketSession, extendedHours, onOpenSettings }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusClass = isLoading
    ? 'status-pill-sync'
    : isStreaming
      ? 'status-pill-turbo'
      : 'status-pill-live';

  const statusLabel = isLoading ? 'SYNCING' : isStreaming ? 'TURBO' : extendedHours ? 'AH LIVE' : 'LIVE';
  const dotClass = isLoading
    ? 'bg-bbg-amber'
    : isStreaming
      ? 'bg-bbg-cyan'
      : 'bg-bbg-green';

  return (
    <>
      <header className="terminal-chrome flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <span className="logo-mark">SPCX</span>
            <div className="hidden sm:flex flex-col gap-0.5">
              <span className="text-bbg-white text-[10px] font-medium tracking-[0.18em] uppercase">
                Space Sector Terminal
              </span>
              <span className="text-bbg-muted text-[9px] tracking-wider">v1.4 · ORBITAL MARKETS</span>
            </div>
          </div>
          <span className="badge-tag badge-green hidden md:inline shrink-0">
            SPCX IPO +56% WK1
          </span>
          {extendedHours && marketSession && (
            <span className="text-[9px] font-semibold tracking-[0.14em] text-bbg-cyan border border-bbg-cyan/30 bg-bbg-cyan-dim px-2 py-0.5 rounded-sm hidden md:inline shrink-0">
              {marketSessionTitle(marketSession).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[11px] shrink-0">
          <span className="text-bbg-gray hidden sm:inline tabular-nums">
            {time.toUTCString().slice(0, 22)} UTC
          </span>

          <div className={`status-pill ${statusClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full live-blink ${dotClass}`} />
            {statusLabel}
          </div>

          {lastRefresh && (
            <span className="text-bbg-muted text-[10px] hidden lg:inline tabular-nums">
              REF {lastRefresh.toLocaleTimeString()}
            </span>
          )}

          <SettingsButton onClick={onOpenSettings} />
        </div>
      </header>
      <div className="terminal-accent-line" />
    </>
  );
}
