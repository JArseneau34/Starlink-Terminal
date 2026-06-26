import { Fragment, useState } from 'react';
import type { ManifestDeparture } from '../../types/launchManifest';
import { formatCountdown, formatDate } from '../../utils/format';

interface DeparturesBoardProps {
  departures: ManifestDeparture[];
  isLoading?: boolean;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('success') || s.includes('go')) return 'text-bbg-green';
  if (s.includes('fail') || s.includes('hold') || s.includes('scrub')) return 'text-bbg-red';
  if (s.includes('sched') || s.includes('tbd')) return 'text-bbg-amber';
  return 'text-bbg-cyan';
}

function scrubColor(pct: number): string {
  if (pct >= 40) return 'text-bbg-red';
  if (pct >= 25) return 'text-bbg-amber';
  return 'text-bbg-green';
}

export function DeparturesBoard({ departures, isLoading }: DeparturesBoardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading && departures.length === 0) {
    return (
      <div className="p-4 text-bbg-gray text-center text-[11px]">Loading departures board…</div>
    );
  }

  if (departures.length === 0) {
    return (
      <div className="p-4 text-bbg-gray text-center text-[11px]">No upcoming departures in feed</div>
    );
  }

  return (
    <div className="departures-board">
      <table className="data-table w-full text-[11px]">
        <thead className="sticky top-0 z-10 departures-board-head">
          <tr className="border-b border-bbg-border-subtle">
            <th className="text-left px-3 py-1.5">ETD</th>
            <th className="text-left px-3 py-1.5">FLIGHT</th>
            <th className="text-left px-3 py-1.5 hidden lg:table-cell">VEHICLE</th>
            <th className="text-left px-3 py-1.5">PAD</th>
            <th className="text-left px-3 py-1.5 hidden md:table-cell">RANGE</th>
            <th className="text-right px-3 py-1.5">WX SCRUB</th>
            <th className="text-right px-3 py-1.5">SLIPS</th>
            <th className="text-left px-3 py-1.5">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {departures.map((dep) => {
            const net = new Date(dep.net);
            const isPast = net < new Date();
            const expanded = expandedId === dep.id;

            return (
              <Fragment key={dep.id}>
                <tr
                  className={`data-row departures-row cursor-pointer ${expanded ? 'departures-row-expanded' : ''}`}
                  onClick={() => setExpandedId(expanded ? null : dep.id)}
                >
                  <td className="px-3 py-1.5 text-bbg-cyan whitespace-nowrap tabular-nums">
                    {isPast ? formatDate(net).split(',')[0] : formatCountdown(net)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="text-bbg-white truncate max-w-[220px]" title={dep.flight}>
                      {dep.flight}
                    </div>
                    <div className="text-bbg-muted text-[10px] truncate">{dep.provider}</div>
                  </td>
                  <td className="px-3 py-1.5 text-bbg-gray hidden lg:table-cell text-[10px]">
                    {dep.vehicle}
                  </td>
                  <td className="px-3 py-1.5 text-bbg-amber text-[10px] whitespace-nowrap">{dep.pad}</td>
                  <td className="px-3 py-1.5 text-bbg-muted hidden md:table-cell text-[10px] truncate max-w-[140px]">
                    {dep.range}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${scrubColor(dep.weatherScrubPct)}`}>
                    {dep.weatherScrubPct}%
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-bbg-gray">
                    {dep.slipCount > 0 ? (
                      <span className="text-bbg-amber">{dep.slipCount}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`px-3 py-1.5 font-medium ${statusColor(dep.status)}`}>{dep.status}</td>
                </tr>
                {expanded && (
                  <tr className="departures-detail-row">
                    <td colSpan={8} className="px-3 py-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                        {dep.mission && (
                          <div>
                            <div className="text-bbg-muted tracking-wider uppercase mb-1">Mission</div>
                            <div className="text-bbg-gray leading-snug">{dep.mission}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-bbg-muted tracking-wider uppercase mb-1">NET</div>
                          <div className="text-bbg-white tabular-nums">{formatDate(net)}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-bbg-muted tracking-wider uppercase mb-1">Slip History</div>
                          {dep.slipHistory.length === 0 ? (
                            <div className="text-bbg-gray">No recorded slips on this NET</div>
                          ) : (
                            <ul className="space-y-1">
                              {dep.slipHistory.map((slip) => (
                                <li key={`${dep.id}-${slip.date}`} className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  <span className="text-bbg-white tabular-nums">
                                    {new Date(slip.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                  <span className="text-bbg-amber">+{slip.deltaDays}d</span>
                                  <span className="text-bbg-gray">{slip.reason}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
