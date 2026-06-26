import { Settings, X, RotateCcw, RefreshCw } from 'lucide-react';
import type { UserSettings, DataSourceStatus } from '../types';

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdate: (patch: Partial<UserSettings>) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
  sources?: DataSourceStatus[];
  apiError?: string | null;
  onForceRefresh?: () => void;
}

const STATUS_COLORS: Record<DataSourceStatus['status'], string> = {
  ok: 'text-bbg-green',
  cached: 'text-bbg-cyan',
  degraded: 'text-bbg-amber',
  seed: 'text-bbg-amber',
  error: 'text-bbg-red',
};

const STATUS_LABELS: Record<DataSourceStatus['status'], string> = {
  ok: 'LIVE',
  cached: 'CACHE',
  degraded: 'DEGRADED',
  seed: 'SEED',
  error: 'ERROR',
};

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 text-bbg-muted hover:text-bbg-amber hover:bg-bbg-amber/10 border border-bbg-border-subtle hover:border-bbg-amber/25 rounded-sm transition-all cursor-pointer"
      title="Settings"
      aria-label="Open settings"
    >
      <Settings size={14} />
    </button>
  );
}

export function SettingsPanel({
  settings,
  onUpdate,
  onReset,
  isOpen,
  onClose,
  sources = [],
  apiError,
  onForceRefresh,
}: SettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed top-0 right-0 h-full w-80 max-w-[90vw] panel-surface border-l border-bbg-border-subtle z-50 flex flex-col shadow-2xl shadow-black/50">
        <div className="panel-header flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-bbg-amber" />
            <span className="panel-title">User Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-bbg-gray hover:text-bbg-white cursor-pointer"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-bbg-gray text-[9px] tracking-widest uppercase">
                Data Sources
              </h3>
              {onForceRefresh && (
                <button
                  onClick={onForceRefresh}
                  className="flex items-center gap-1 text-[9px] text-bbg-cyan hover:text-bbg-white cursor-pointer"
                >
                  <RefreshCw size={10} />
                  Force refresh
                </button>
              )}
            </div>
            {apiError && (
              <p className="text-bbg-red text-[10px] mb-2 border border-bbg-red/30 px-2 py-1">
                {apiError}
              </p>
            )}
            <div className="space-y-1.5">
              {sources.length === 0 ? (
                <p className="text-bbg-gray text-[10px]">No source status yet</p>
              ) : (
                sources.map((src) => (
                  <div
                    key={src.name}
                    className="border border-bbg-border px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-bbg-white text-[10px]">{src.name}</span>
                      <span className={`text-[9px] font-medium ${STATUS_COLORS[src.status]}`}>
                        {STATUS_LABELS[src.status]}
                      </span>
                    </div>
                    {src.message && (
                      <p className="text-bbg-gray text-[9px] mt-0.5">{src.message}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <p className="text-bbg-gray text-[9px] mt-2">
              Add FINNHUB_API_KEY to .env for live quotes. See .env.example.
            </p>
          </section>

          <section>
            <h3 className="text-bbg-gray text-[9px] tracking-widest uppercase mb-2">
              Data
            </h3>
            <label className="block py-2 border-b border-bbg-border/50">
              <span className="text-bbg-white text-[11px] block mb-1.5">
                Refresh interval (seconds)
              </span>
              <select
                value={settings.refreshInterval}
                onChange={(e) => onUpdate({ refreshInterval: Number(e.target.value) })}
                className="w-full bg-black border border-bbg-border text-bbg-white text-[11px] px-2 py-1.5 outline-none focus:border-bbg-amber"
              >
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
              </select>
            </label>
          </section>

          <section>
            <h3 className="text-bbg-gray text-[9px] tracking-widest uppercase mb-2">
              Coming Soon
            </h3>
            <div className="space-y-1.5">
              {['Price alerts', 'Portfolio tracking', 'Space weather panel', 'SEC filings feed'].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center justify-between py-1.5 px-2 border border-bbg-border/30 opacity-50"
                >
                  <span className="text-bbg-gray text-[10px]">{feature}</span>
                  <span className="text-bbg-amber-dim text-[9px]">SOON</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-3 border-t border-bbg-border bg-black">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-bbg-border text-bbg-gray hover:text-bbg-white hover:border-bbg-amber text-[10px] cursor-pointer transition-colors"
          >
            <RotateCcw size={11} />
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}
