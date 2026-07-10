import { TRANSIT_SHELL_INDEX } from '../data/orbitalShellClassification';
import { isGrantedShellIndex } from '../data/shellReference';
import type { StarlinkCatalogPayload, StarlinkIntelPayload } from '../types/orbital';

export interface FleetTierExclusions {
  staleElement: number;
  uncontrolledDecay: number;
  transit: number;
}

export interface FleetTierKpis {
  inOrbit: number | null;
  working: number | null;
  operational: number | null;
  exclusions: FleetTierExclusions;
  liveAvailable: boolean;
  sources: {
    inOrbit: string;
    working: string;
    operational: string;
  };
}

export const FLEET_TIER_TOOLTIPS = {
  inOrbit:
    'IN ORBIT — All objects with a current NORAD/CelesTrak TLE in the Starlink group. Matches CelesTrak/NORAD headline catalog count.',
  working:
    'WORKING — In-orbit TLE count minus stale elements and uncontrolled decay. Requires live CelesTrak feed.',
  operational:
    'OPERATIONAL — TLE mean elements indicate stable mission orbit (perigee ≥350 km) in an assigned FCC orbital shell. Transit, raising, and decay excluded.',
} as const;

const STALE_EPOCH_HOURS = 168;

function epochAgeHours(epoch: string, now = Date.now()): number {
  const t = Date.parse(epoch);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 3_600_000);
}

function countExclusionsFromCatalog(catalog: StarlinkCatalogPayload | null): FleetTierExclusions {
  if (!catalog?.satellites.length) {
    return { staleElement: 0, uncontrolledDecay: 0, transit: 0 };
  }
  const now = Date.now();
  let staleElement = 0;
  let uncontrolledDecay = 0;
  let transit = 0;
  for (const sat of catalog.satellites) {
    if (sat.shell === TRANSIT_SHELL_INDEX) transit++;
    if (sat.lifecycle === 'deorbiting') uncontrolledDecay++;
    if (epochAgeHours(sat.epoch, now) > STALE_EPOCH_HOURS) staleElement++;
  }
  return { staleElement, uncontrolledDecay, transit };
}

export function computeFleetTierKpis(
  catalog: StarlinkCatalogPayload | null,
  intel: StarlinkIntelPayload | null
): FleetTierKpis {
  const liveAvailable =
    intel?.liveTleAvailable !== false &&
    (catalog?.count ?? 0) > 0 &&
    catalog?.tleOffline !== true;

  const exclusions = liveAvailable && catalog
    ? countExclusionsFromCatalog(catalog)
    : { staleElement: 0, uncontrolledDecay: 0, transit: 0 };

  const inOrbit = liveAvailable ? (catalog?.count ?? null) : null;

  let working: number | null = null;
  if (liveAvailable && inOrbit != null) {
    working = Math.max(
      0,
      inOrbit - exclusions.staleElement - exclusions.uncontrolledDecay
    );
  }

  let operational: number | null = null;
  if (liveAvailable && catalog?.satellites.length) {
    operational = catalog.satellites.filter(
      (s) => s.lifecycle === 'operational' && isGrantedShellIndex(s.shell)
    ).length;
  }

  return {
    inOrbit,
    working,
    operational,
    exclusions,
    liveAvailable,
    sources: {
      inOrbit: liveAvailable
        ? `CelesTrak · ${catalog?.tleSource ?? 'TLE'}`
        : 'TLE offline',
      working: liveAvailable ? 'derived · in orbit − stale − decay' : 'TLE offline',
      operational: liveAvailable ? 'live TLE · mean elements' : 'TLE offline',
    },
  };
}

export function formatTierValue(value: number | null, loading = false): string {
  if (loading) return '…';
  if (value == null || value < 0) return '—';
  return value.toLocaleString();
}
