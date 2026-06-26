import { useMemo, useState } from 'react';
import type { PadContentionDay } from '../../types/launchManifest';
import { TRACKED_PADS } from '../../data/launchManifest';

interface PadContentionCalendarProps {
  calendar: PadContentionDay[];
}

function slotTime(net: string): string {
  return new Date(net).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

export function PadContentionCalendar({ calendar }: PadContentionCalendarProps) {
  const [selectedDay, setSelectedDay] = useState(0);
  const day = calendar[selectedDay];

  const contentionPads = useMemo(() => {
    if (!day) return [];
    return TRACKED_PADS.map((pad) => ({
      pad,
      slots: day.pads[pad] ?? [],
    })).filter((row) => row.slots.length > 0);
  }, [day]);

  const openPads = useMemo(() => {
    if (!day) return TRACKED_PADS.length;
    return TRACKED_PADS.filter((pad) => (day.pads[pad] ?? []).length === 0).length;
  }, [day]);

  if (!day) {
    return <div className="p-4 text-bbg-gray text-center text-[11px]">No pad calendar data</div>;
  }

  return (
    <div className="p-2 h-full flex flex-col gap-2 min-h-0">
      <div className="flex gap-1 overflow-x-auto pb-1 shrink-0">
        {calendar.map((d, i) => {
          const busy = TRACKED_PADS.reduce((n, pad) => n + (d.pads[pad]?.length ?? 0), 0);
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDay(i)}
              className={`pad-day-chip ${selectedDay === i ? 'pad-day-chip-active' : ''}`}
            >
              <span className="block text-[9px] text-bbg-muted">{d.label.split(',')[0]}</span>
              <span className="block text-[10px] tabular-nums mt-0.5">{busy || '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] px-1 shrink-0">
        <span className="text-bbg-white">{day.label} UTC</span>
        <span className="text-bbg-muted">
          {contentionPads.length} pad{contentionPads.length === 1 ? '' : 's'} active · {openPads} open
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {contentionPads.length === 0 ? (
          <div className="p-4 text-center text-bbg-gray text-[11px]">No launches scheduled — all pads open</div>
        ) : (
          <table className="data-table w-full text-[10px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bbg-border-subtle">
                <th className="text-left px-2 py-1">PAD</th>
                <th className="text-left px-2 py-1">UTC</th>
                <th className="text-left px-2 py-1">FLIGHT</th>
                <th className="text-left px-2 py-1 hidden sm:table-cell">VEHICLE</th>
              </tr>
            </thead>
            <tbody>
              {contentionPads.flatMap(({ pad, slots }) =>
                slots.map((slot) => (
                  <tr key={`${pad}-${slot.launchId}`} className="data-row">
                    <td className="px-2 py-1.5 text-bbg-amber whitespace-nowrap">{pad}</td>
                    <td className="px-2 py-1.5 text-bbg-cyan tabular-nums">{slotTime(slot.net)}</td>
                    <td className="px-2 py-1.5">
                      <div className="text-bbg-white truncate max-w-[160px]" title={slot.flight}>
                        {slot.flight}
                      </div>
                      <div className="text-bbg-muted text-[9px]">{slot.provider}</div>
                    </td>
                    <td className="px-2 py-1.5 text-bbg-gray hidden sm:table-cell truncate max-w-[120px]">
                      {slot.vehicle}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
