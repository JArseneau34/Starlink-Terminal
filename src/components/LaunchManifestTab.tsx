import { useState } from 'react';
import { Panel } from './Panel';
import { SubTabs } from './SubTabs';
import { useLaunchManifestData } from '../hooks/useLaunchManifestData';
import { DeparturesBoard } from './launch-manifest/DeparturesBoard';
import { CostPerKgChart } from './launch-manifest/CostPerKgChart';
import { PadContentionCalendar } from './launch-manifest/PadContentionCalendar';
import { VehicleModelsPanel } from './launch-manifest/VehicleModelsPanel';
import { ROCKET_FLEET } from './launch-manifest/rocketGeometry';
import { LaunchSiteMap } from './launch-manifest/LaunchSiteMap';

export type ManifestSubTab = 'departures' | 'sites' | 'cost' | 'pads' | 'vehicles';

export function LaunchManifestTab() {
  const { data, isLoading, error, lastRefresh, refresh } = useLaunchManifestData();
  const [activeSubTab, setActiveSubTab] = useState<ManifestSubTab>('departures');

  const fetchedLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '…';

  const statusBadge =
    error ? (
      <span className="text-bbg-red text-[9px] tracking-wider">{error}</span>
    ) : data?.source && data.source.status !== 'ok' ? (
      <span className="text-bbg-amber text-[9px] tracking-wider" title={data.source.message}>
        {data.source.message ?? data.source.name}
      </span>
    ) : (
      <span className="text-bbg-muted text-[9px] tracking-wider hidden sm:inline">
        LL2 FEED
      </span>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SubTabs<ManifestSubTab>
        active={activeSubTab}
        onChange={setActiveSubTab}
        tabs={[
          { id: 'departures', label: 'DEPARTURES', count: data?.departures.length },
          { id: 'sites', label: 'LAUNCH SITES', count: data?.launchSites.length },
          { id: 'cost', label: '$/KG INDEX' },
          { id: 'pads', label: 'PAD CONTENTION' },
          { id: 'vehicles', label: 'VEHICLES', count: ROCKET_FLEET.length },
        ]}
        headerRight={
          <>
            {statusBadge}
            <button
              type="button"
              onClick={() => refresh(true)}
              disabled={isLoading}
              className="text-bbg-cyan text-[9px] tracking-wider hover:text-bbg-white disabled:opacity-50"
              title="Force refresh manifest data"
            >
              {isLoading ? 'SYNC…' : `UPD ${fetchedLabel}`}
            </button>
          </>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 p-px terminal-grid">
        {activeSubTab === 'departures' && (
          <Panel
            title="Upcoming Flights — Departures Board"
            flex={1}
            className="flex-1 min-h-0"
            headerRight={
              <span className="text-bbg-muted text-[9px] tracking-wider">
                WX SCRUB · SLIP HISTORY · NET COUNTDOWN
              </span>
            }
          >
            <DeparturesBoard departures={data?.departures ?? []} isLoading={isLoading} />
          </Panel>
        )}

        {activeSubTab === 'sites' && (
          <Panel
            title="Active Pads Worldwide"
            flex={1}
            className="flex-1 min-h-0"
            headerRight={
              <span className="text-bbg-muted text-[9px] tracking-wider">
                LL2 LOCATIONS · UPCOMING · RECENT
              </span>
            }
          >
            <LaunchSiteMap sites={data?.launchSites ?? []} isLoading={isLoading} />
          </Panel>
        )}

        {activeSubTab === 'cost' && (
          <Panel
            title="$/kg-to-LEO Index — Orbital Cost Benchmark"
            flex={1}
            className="flex-1 min-h-0"
            headerRight={
              data?.costIndex ? (
                <span className="text-bbg-amber text-[9px] tabular-nums tracking-wider">
                  SPOT ${data.costIndex.spot.toLocaleString()}/kg
                </span>
              ) : undefined
            }
          >
            {data?.costIndex ? (
              <CostPerKgChart index={data.costIndex} />
            ) : (
              <div className="p-4 text-bbg-gray text-center text-[11px]">Loading cost index…</div>
            )}
          </Panel>
        )}

        {activeSubTab === 'pads' && (
          <Panel
            title="Pad & Range Contention — 21-Day Calendar"
            flex={1}
            className="flex-1 min-h-0"
            headerRight={
              <span className="text-bbg-muted text-[9px] tracking-wider">
                SLC-40 · LC-39A · SLC-4E · LC-1 · KOUROU
              </span>
            }
          >
            <PadContentionCalendar calendar={data?.padCalendar ?? []} />
          </Panel>
        )}

        {activeSubTab === 'vehicles' && (
          <Panel
            title="Launch Vehicle Fleet — 3D Pad View"
            flex={1}
            className="flex-1 min-h-0"
            headerRight={
              <span className="text-bbg-muted text-[9px] tracking-wider">
                {ROCKET_FLEET.length} VEHICLES · STARFIELD · TRUE SCALE
              </span>
            }
          >
            <VehicleModelsPanel vehicles={data?.vehicles ?? []} />
          </Panel>
        )}
      </div>
    </div>
  );
}
