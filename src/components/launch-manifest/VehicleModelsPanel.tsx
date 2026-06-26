import { useMemo, useState } from 'react';
import type { VehicleSpec } from '../../types/launchManifest';
import { SubTabs } from '../SubTabs';
import { RocketModelCanvas } from './RocketModelCanvas';
import { VehicleComparator } from './VehicleComparator';
import {
  F9_BASELINE_THRUST_KN,
  FLEET_LAYOUT,
  formatThrustKn,
  getRocketById,
  ROCKET_FLEET,
  thrustBarRatio,
  VEHICLE_SPEC_MAP,
  type RocketFleetId,
  type RocketModelStats,
  type RocketVehicleDef,
} from './rocketGeometry';

export type VehicleViewTab = 'fleet-3d' | 'specs';

interface VehicleModelsPanelProps {
  vehicles: VehicleSpec[];
}

function ThrustBar({ thrustKn }: { thrustKn: number }) {
  const ratio = thrustBarRatio(thrustKn);
  const vsF9 = thrustKn / F9_BASELINE_THRUST_KN;
  return (
    <div className="mt-3 pt-3 border-t border-bbg-border-subtle/50">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[9px] text-bbg-muted tracking-[0.12em]">LIFTOFF THRUST</span>
        <span className="text-[10px] text-bbg-amber tabular-nums font-mono">{formatThrustKn(thrustKn)}</span>
      </div>
      <div className="h-2 bg-[#12121a] border border-bbg-border-subtle/40 rounded-sm overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-bbg-cyan/70 via-bbg-amber/80 to-orange-500/90 transition-all duration-300"
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[8px] text-bbg-muted tabular-nums">
        <span>0</span>
        <span className="text-bbg-cyan/70">F9 · 7.6 MN</span>
        <span>76 MN</span>
      </div>
      <div className="text-[9px] text-bbg-gray mt-1.5 tabular-nums">
        {vsF9 >= 1 ? `${vsF9.toFixed(1)}× Falcon 9` : `${(vsF9 * 100).toFixed(0)}% of Falcon 9`}
      </div>
    </div>
  );
}

function RocketSpecPanel({
  model,
  stats,
  vehicleSpec,
  isLaunching,
  onLaunch,
}: {
  model: RocketVehicleDef;
  stats: RocketModelStats;
  vehicleSpec?: VehicleSpec;
  isLaunching: boolean;
  onLaunch: (id: RocketFleetId) => void;
}) {
  const thrustKn = vehicleSpec?.thrustKn ?? model.thrustKn;
  const rows = useMemo(() => {
    const base = Object.entries(stats).map(([label, value]) => ({ label, value }));
    if (!vehicleSpec) return base;
    return [
      ...base,
      { label: 'Provider', value: vehicleSpec.provider },
      { label: 'Status', value: vehicleSpec.status },
      {
        label: '$/kg LEO',
        value: vehicleSpec.costPerKgLeo > 0 ? `$${vehicleSpec.costPerKgLeo.toLocaleString()}` : '—',
      },
    ];
  }, [stats, vehicleSpec, thrustKn]);

  return (
    <div className="rocket-spec-panel h-full flex flex-col border-l border-bbg-border-subtle bg-[#08080d]">
      <div className="px-3 py-2 border-b border-bbg-border-subtle shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-bbg-amber text-[11px] font-semibold tracking-[0.12em]">{model.name.toUpperCase()}</div>
            <div className="text-bbg-muted text-[9px] tracking-wider mt-0.5">
              vehicle bay · studio lighting · true scale · {formatThrustKn(thrustKn)} liftoff
            </div>
          </div>
          <button
            type="button"
            disabled={isLaunching}
            onClick={() => onLaunch(model.id)}
            className={`rocket-view-btn shrink-0 text-[9px] tracking-[0.14em] px-2.5 py-1 border rounded-sm font-semibold ${
              isLaunching
                ? 'border-bbg-amber/40 text-bbg-amber/70 cursor-wait'
                : 'border-bbg-amber text-bbg-amber bg-bbg-amber/10 hover:bg-bbg-amber/20'
            }`}
          >
            {isLaunching ? 'LIFTOFF…' : 'LAUNCH'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <ThrustBar thrustKn={thrustKn} />
        <table className="w-full text-[10px] mt-3">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-bbg-border-subtle/40">
                <td className="py-1.5 pr-3 text-bbg-muted whitespace-nowrap">{row.label}</td>
                <td className="py-1.5 text-bbg-white text-right tabular-nums">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Fleet3DView({ vehicles }: { vehicles: VehicleSpec[] }) {
  const [selectedId, setSelectedId] = useState<RocketFleetId | null>(null);
  const [hoveredId, setHoveredId] = useState<RocketFleetId | null>(null);
  const [autoSpin, setAutoSpin] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [launchToken, setLaunchToken] = useState(0);
  const [launchVehicleId, setLaunchVehicleId] = useState<RocketFleetId | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const inDetail = selectedId !== null;
  const selectedModel = selectedId ? getRocketById(selectedId) : null;
  const vehicleSpec = selectedId
    ? vehicles.find((v) => v.id === VEHICLE_SPEC_MAP[selectedId])
    : undefined;

  const triggerLaunch = (id: RocketFleetId) => {
    if (isLaunching) return;
    setLaunchVehicleId(id);
    setLaunchToken((t) => t + 1);
  };

  const openVehicle = (id: RocketFleetId) => {
    if (isLaunching) return;
    setSelectedId(id);
  };

  const backToFleet = () => {
    if (isLaunching) return;
    setSelectedId(null);
    setResetToken((t) => t + 1);
  };

  const listHighlight = inDetail ? selectedId : hoveredId;

  return (
    <div className="rocket-fleet-view flex flex-col lg:flex-row h-full min-h-0">
      <nav className="rocket-fleet-list w-full lg:w-[188px] shrink-0 border-r border-bbg-border-subtle bg-[#06060b] overflow-auto max-h-[140px] lg:max-h-none">
        <div className="px-2 py-1.5 border-b border-bbg-border-subtle">
          <span className="text-[9px] text-bbg-muted tracking-[0.14em]">VEHICLE FLEET</span>
        </div>
        {FLEET_LAYOUT.map((rocket) => (
          <div
            key={rocket.id}
            className={`rocket-fleet-item flex items-stretch border-b border-bbg-border-subtle/30 ${
              listHighlight === rocket.id ? 'bg-[#1d3a6e]' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => openVehicle(rocket.id)}
              disabled={isLaunching}
              className={`flex-1 text-left px-3 py-2 text-[11px] font-mono tracking-wide min-w-0 ${
                listHighlight === rocket.id
                  ? 'text-bbg-white font-semibold'
                  : 'text-bbg-gray hover:bg-white/[0.04] hover:text-bbg-white'
              }`}
            >
              <span>{rocket.name}</span>
              <span
                className={`float-right text-[9px] tabular-nums ${
                  listHighlight === rocket.id ? 'text-bbg-cyan/80' : 'text-bbg-muted'
                }`}
              >
                {rocket.stats.Height}
                <span className="ml-1 opacity-70">{formatThrustKn(rocket.thrustKn)}</span>
              </span>
            </button>
            <button
              type="button"
              title={`Launch ${rocket.name} from fleet pad`}
              disabled={isLaunching || inDetail}
              onClick={() => triggerLaunch(rocket.id)}
              className={`shrink-0 px-2 text-[9px] tracking-[0.12em] font-semibold border-l border-bbg-border-subtle/40 ${
                isLaunching
                  ? 'text-bbg-muted cursor-not-allowed'
                  : 'text-bbg-amber hover:bg-bbg-amber/10 hover:text-bbg-white'
              }`}
            >
              GO
            </button>
          </div>
        ))}
      </nav>

      <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0 relative">
        <div className="absolute top-2 left-2 z-10">
          <span className="text-[9px] tracking-[0.14em] text-bbg-muted bg-[#06060b]/80 border border-bbg-border-subtle/50 px-2 py-1 rounded-sm">
            {inDetail ? 'VEHICLE BAY' : 'FLEET PAD'}
          </span>
        </div>
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={() => setAutoSpin((v) => !v)}
            disabled={isLaunching}
            className={`rocket-view-btn text-[9px] tracking-wider px-2 py-1 border rounded-sm ${
              autoSpin
                ? 'border-bbg-cyan text-bbg-cyan bg-bbg-cyan/10'
                : 'border-bbg-border-subtle text-bbg-muted hover:text-bbg-white'
            }`}
          >
            AUTO-SPIN
          </button>
          {inDetail ? (
            <button
              type="button"
              disabled={isLaunching}
              onClick={backToFleet}
              className="rocket-view-btn text-[9px] tracking-wider px-2 py-1 border border-bbg-border-subtle text-bbg-muted rounded-sm hover:text-bbg-white"
            >
              ← FLEET PAD
            </button>
          ) : null}
        </div>

        {inDetail && selectedId ? (
          <RocketModelCanvas
            key={selectedId}
            mode="single"
            vehicleId={selectedId}
            autoSpin={autoSpin}
            launchToken={launchToken}
            launchVehicleId={launchVehicleId}
            onLaunchingChange={setIsLaunching}
            className="flex-1 min-h-[280px]"
          />
        ) : (
          <RocketModelCanvas
            mode="fleet"
            autoSpin={autoSpin}
            resetToken={resetToken}
            launchToken={launchToken}
            launchVehicleId={launchVehicleId}
            onLaunchingChange={setIsLaunching}
            onHoverVehicle={setHoveredId}
            onSelectVehicle={(id) => id && openVehicle(id)}
            className="flex-1 min-h-[280px]"
          />
        )}

        <div className="rocket-view-hint text-center text-[9px] text-bbg-muted tracking-wider py-1.5 border-t border-bbg-border-subtle shrink-0">
          {inDetail ? (
            <>
              <span className="text-bbg-cyan">launch</span> LAUNCH ·{' '}
              <span className="text-bbg-cyan">drag</span> orbit ·{' '}
              <span className="text-bbg-cyan">scroll</span> zoom ·{' '}
              <span className="text-bbg-cyan">← fleet pad</span> to return
            </>
          ) : (
            <>
              <span className="text-bbg-cyan">click</span> a vehicle to inspect ·{' '}
              <span className="text-bbg-cyan">go</span> pad liftoff ·{' '}
              <span className="text-bbg-cyan">drag</span> orbit ·{' '}
              <span className="text-bbg-cyan">scroll</span> zoom
            </>
          )}
        </div>
      </div>

      <div className="w-full lg:w-[220px] shrink-0 min-h-[160px] lg:min-h-0">
        {inDetail && selectedModel ? (
          <RocketSpecPanel
            model={selectedModel}
            stats={selectedModel.stats}
            vehicleSpec={vehicleSpec}
            isLaunching={isLaunching}
            onLaunch={triggerLaunch}
          />
        ) : (
          <div className="rocket-spec-panel h-full flex items-center justify-center border-l border-bbg-border-subtle bg-[#08080d] p-4 text-center">
            <p className="text-bbg-muted text-[10px] leading-relaxed">
              Fleet pad — all vehicles at true scale.
              <br />
              Click a rocket or pick from the list to open its vehicle bay.
              <br />
              <span className="text-bbg-gray text-[9px]">
                {ROCKET_FLEET.length} vehicles · height ruler on pad
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VehicleModelsPanel({ vehicles }: VehicleModelsPanelProps) {
  const [activeTab, setActiveTab] = useState<VehicleViewTab>('fleet-3d');

  return (
    <div className="vehicle-models-panel flex flex-col h-full min-h-0">
      <SubTabs<VehicleViewTab>
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'fleet-3d', label: 'FLEET 3D', count: ROCKET_FLEET.length },
          { id: 'specs', label: 'SPECS TABLE', count: vehicles.length },
        ]}
        headerRight={
          activeTab === 'fleet-3d' ? (
            <span className="text-bbg-muted text-[9px] tracking-wider hidden sm:inline">
              LAUNCH PAD · NIGHT OPS
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'specs' ? (
          <VehicleComparator vehicles={vehicles} />
        ) : (
          <Fleet3DView vehicles={vehicles} />
        )}
      </div>
    </div>
  );
}
