import type { Launch } from '../types';
import { formatDate, formatCountdown } from '../utils/format';

interface LaunchCalendarProps {
  launches: Launch[];
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('success') || s.includes('go')) return 'text-bbg-green';
  if (s.includes('fail') || s.includes('hold') || s.includes('scrub')) return 'text-bbg-red';
  if (s.includes('sched') || s.includes('tbd')) return 'text-bbg-amber';
  return 'text-bbg-cyan';
}

export function LaunchCalendar({ launches }: LaunchCalendarProps) {
  const sorted = [...launches]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 15);

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-bbg-gray text-center text-[11px]">
        Loading launch schedule...
      </div>
    );
  }

  return (
    <table className="data-table w-full text-[11px]">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-bbg-border-subtle">
          <th className="text-left px-3 py-1.5">T-MINUS</th>
          <th className="text-left px-3 py-1.5">MISSION</th>
          <th className="text-left px-3 py-1.5 hidden md:table-cell">PROVIDER</th>
          <th className="text-left px-3 py-1.5">STATUS</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((launch) => {
          const isPast = launch.date < new Date() && launch.status !== 'Scheduled';
          return (
            <tr
              key={launch.id}
              className={`data-row ${isPast ? 'opacity-45' : ''}`}
            >
              <td className="px-3 py-1.5 text-bbg-cyan whitespace-nowrap tabular-nums">
                {isPast ? formatDate(launch.date).split(',')[0] : formatCountdown(launch.date)}
              </td>
              <td className="px-3 py-1.5">
                <div className="text-bbg-white truncate max-w-[200px]" title={launch.name}>
                  {launch.name}
                </div>
                <div className="text-bbg-muted text-[10px] truncate">
                  {launch.rocket} · {launch.location}
                </div>
              </td>
              <td className="px-3 py-1.5 text-bbg-amber hidden md:table-cell text-[10px]">
                {launch.provider}
              </td>
              <td className={`px-3 py-1.5 font-medium ${statusColor(launch.status)}`}>
                {launch.status}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
