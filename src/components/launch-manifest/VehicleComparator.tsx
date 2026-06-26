import { useEffect, useMemo, useState } from 'react';
import type { VehicleSpec } from '../../types/launchManifest';

interface VehicleComparatorProps {
  vehicles: VehicleSpec[];
}

const COMPARE_SLOTS = 3;

function fmtKg(kg: number): string {
  if (kg <= 0) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg.toLocaleString()} kg`;
}

function fmtThrust(kn: number | null | undefined): string {
  if (kn == null || kn <= 0) return '—';
  if (kn >= 1000) return `${(kn / 1000).toFixed(1)} MN`;
  return `${kn.toLocaleString()} kN`;
}

function fmtM(m: number | null | undefined): string {
  if (m == null || m <= 0) return '—';
  return `${m.toFixed(1)} m`;
}

function statusColor(status: string): string {
  if (status === 'ACTIVE') return 'text-bbg-green';
  if (status === 'TEST' || status === 'DEV') return 'text-bbg-amber';
  if (status === 'RETIRING') return 'text-bbg-muted';
  return 'text-bbg-gray';
}

interface CompareRow {
  label: string;
  values: (string | number)[];
  highlight?: boolean;
}

export function VehicleComparator({ vehicles }: VehicleComparatorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (vehicles.length > 0 && selectedIds.length === 0) {
      setSelectedIds(vehicles.slice(0, COMPARE_SLOTS).map((v) => v.id));
    }
  }, [vehicles, selectedIds.length]);

  const selected = useMemo(() => {
    return selectedIds.map((id, i) => {
      const found = vehicles.find((v) => v.id === id);
      return found ?? vehicles[i] ?? null;
    }).filter((v): v is VehicleSpec => v != null);
  }, [selectedIds, vehicles]);

  const setSlot = (slot: number, id: string) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[slot] = id;
      return next;
    });
  };

  const rows: CompareRow[] = useMemo(() => {
    const vals = (fn: (v: VehicleSpec) => string) => selected.map(fn);
    return [
      { label: 'LEO payload', values: vals((v) => fmtKg(v.payloadLeoKg)), highlight: true },
      { label: 'GTO payload', values: vals((v) => fmtKg(v.payloadGtoKg)), highlight: true },
      { label: 'Thrust (liftoff)', values: vals((v) => fmtThrust(v.thrustKn)) },
      { label: 'Height', values: vals((v) => fmtM(v.heightM)) },
      { label: 'Diameter', values: vals((v) => fmtM(v.diameterM)) },
      { label: 'Reusability', values: vals((v) => v.reusable) },
      { label: 'Fairing volume', values: vals((v) => (v.fairingVolumeM3 > 0 ? `${v.fairingVolumeM3} m³` : '—')) },
      { label: '$/kg LEO (est.)', values: vals((v) => (v.costPerKgLeo > 0 ? `$${v.costPerKgLeo.toLocaleString()}` : '—')) },
      { label: 'Status', values: vals((v) => v.status) },
    ];
  }, [selected]);

  if (vehicles.length === 0) {
    return <div className="p-4 text-bbg-gray text-center text-[11px]">No vehicle data</div>;
  }

  return (
    <div className="vehicle-comparator p-2 overflow-auto">
      <div className="vehicle-compare-slots grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {Array.from({ length: COMPARE_SLOTS }, (_, slot) => (
          <label key={slot} className="flex flex-col gap-1">
            <span className="text-[9px] text-bbg-muted tracking-wider">VEHICLE {slot + 1}</span>
            <select
              className="vehicle-compare-select text-[10px] border border-bbg-border-subtle text-bbg-white px-2 py-1 rounded-sm"
              style={{ background: 'var(--color-bbg-panel)' }}
              value={selectedIds[slot] ?? ''}
              onChange={(e) => setSlot(slot, e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle}
                </option>
              ))}
            </select>
            {selected[slot] && (
              <span className="text-[9px] text-bbg-muted truncate">{selected[slot]!.provider}</span>
            )}
          </label>
        ))}
      </div>

      <table className="vehicle-compare-table w-full text-[10px]">
        <thead>
          <tr className="border-b border-bbg-border-subtle">
            <th className="text-left px-2 py-1.5 text-bbg-muted font-normal w-[28%]">METRIC</th>
            {selected.map((v) => (
              <th key={v.id} className="text-left px-2 py-1.5 text-bbg-white font-medium truncate">
                {v.vehicle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="data-row border-b border-bbg-border-subtle/50">
              <td className="px-2 py-1.5 text-bbg-muted whitespace-nowrap">{row.label}</td>
              {row.values.map((val, i) => (
                <td
                  key={i}
                  className={`px-2 py-1.5 tabular-nums ${
                    row.label === 'Status'
                      ? statusColor(String(val))
                      : row.highlight
                        ? 'text-bbg-cyan'
                        : 'text-bbg-gray'
                  }`}
                >
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
