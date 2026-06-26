import { getCached, setCache, coalesceAsync } from '../cache.js';
import { fetchLaunches } from './launches.js';
import type {
  CostPerKgIndex,
  LaunchManifestPayload,
  LaunchSite,
  ManifestDeparture,
  PadContentionDay,
  PadSlot,
  SlipEvent,
  VehicleSpec,
} from '../../src/types/launchManifest.js';
import {
  COST_PER_KG_HISTORY,
  normalizePadName,
  TRACKED_PADS,
  VEHICLE_SPECS,
} from '../../src/data/launchManifest.js';
import { fetchLaunchSites, fetchVehicleSpecs, buildSeedLaunchSites } from './launchEnrichment.js';

const CACHE_KEY = 'launch-manifest:v8';
const CACHE_TTL_MS = 3 * 60 * 1000;
const ENRICHMENT_BUDGET_MS = 12_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SLIP_REASONS = [
  'Upper-level winds',
  'Range safety',
  'Payload readiness',
  'Ground systems',
  'Weather (anvil cloud)',
  'Booster recycle',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function estimateWeatherScrubPct(location: string, net: Date, ll2Probability?: number | null): number {
  if (ll2Probability != null && ll2Probability > 0) {
    return Math.max(5, Math.min(85, Math.round(100 - ll2Probability)));
  }

  const loc = location.toLowerCase();
  const month = net.getUTCMonth();
  let base = 18;

  if (loc.includes('canaveral') || loc.includes('kennedy') || loc.includes('patrick')) {
    base = month >= 5 && month <= 9 ? 34 : month >= 3 && month <= 5 ? 28 : 22;
  } else if (loc.includes('vandenberg')) {
    base = month >= 10 || month <= 2 ? 32 : 20;
  } else if (loc.includes('mahia') || loc.includes('new zealand')) {
    base = 24;
  } else if (loc.includes('kourou') || loc.includes('guiana')) {
    base = 16;
  } else if (loc.includes('india') || loc.includes('sriharikota')) {
    base = month >= 5 && month <= 8 ? 30 : 18;
  }

  const dayJitter = (hashId(loc) + net.getUTCDate()) % 9;
  return Math.min(72, base + dayJitter);
}

function buildSlipHistory(id: string, net: Date, status: string): SlipEvent[] {
  const h = hashId(id);
  const slipCount = status.toLowerCase().includes('hold') ? 2 + (h % 2) : h % 4;
  if (slipCount === 0) return [];

  const events: SlipEvent[] = [];
  let cursor = new Date(net);

  for (let i = 0; i < slipCount; i++) {
    const deltaDays = 2 + ((h + i * 7) % 11);
    cursor = new Date(cursor.getTime() - deltaDays * 86_400_000);
    events.push({
      date: cursor.toISOString(),
      reason: SLIP_REASONS[(h + i) % SLIP_REASONS.length]!,
      deltaDays,
    });
  }

  return events.reverse();
}

function buildDepartures(
  launches: Awaited<ReturnType<typeof fetchLaunches>>['launches']
): ManifestDeparture[] {
  return launches
    .map((launch) => {
      const net = new Date(launch.date);
      const pad = launch.pad ?? normalizePadName(launch.location);
      const range = launch.range ?? launch.location.split(',')[1]?.trim() ?? launch.location;
      const slips = buildSlipHistory(launch.id, net, launch.status);

      return {
        id: launch.id,
        flight: launch.name,
        provider: launch.provider,
        vehicle: launch.rocket,
        pad,
        range,
        net: net.toISOString(),
        status: launch.status,
        mission: launch.mission,
        weatherScrubPct: estimateWeatherScrubPct(launch.location, net, launch.probability),
        slipCount: slips.length,
        slipHistory: slips,
      };
    })
    .sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime());
}

function buildCostIndex(): CostPerKgIndex {
  const series = [...COST_PER_KG_HISTORY];
  const spot = series[series.length - 1]!.usdPerKg;
  const prior30 = series[series.length - 3]?.usdPerKg ?? spot;
  const ytdStart = series.find((p) => p.date.startsWith('2026-01'))?.usdPerKg ?? spot;

  return {
    spot,
    changePct30d: ((spot - prior30) / prior30) * 100,
    changePctYtd: ((spot - ytdStart) / ytdStart) * 100,
    series,
  };
}

function buildPadCalendar(departures: ManifestDeparture[]): PadContentionDay[] {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const days: PadContentionDay[] = [];

  for (let d = 0; d < 21; d++) {
    const day = new Date(start.getTime() + d * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const pads: Record<string, PadSlot[]> = {};
    for (const pad of TRACKED_PADS) pads[pad] = [];

    for (const dep of departures) {
      const net = new Date(dep.net);
      if (net.toISOString().slice(0, 10) !== key) continue;
      const padKey = TRACKED_PADS.includes(dep.pad as (typeof TRACKED_PADS)[number])
        ? dep.pad
        : normalizePadName(dep.pad);
      if (!pads[padKey]) pads[padKey] = [];
      pads[padKey].push({
        launchId: dep.id,
        flight: dep.flight,
        provider: dep.provider,
        vehicle: dep.vehicle,
        net: dep.net,
        status: dep.status,
      });
    }

    days.push({ date: key, label, pads });
  }

  return days;
}

function mergeManifest(
  departures: ManifestDeparture[],
  launchSites: LaunchSite[],
  vehicles: VehicleSpec[],
  status: Awaited<ReturnType<typeof fetchLaunches>>['status']
): LaunchManifestPayload {
  return {
    departures,
    costIndex: buildCostIndex(),
    padCalendar: buildPadCalendar(departures),
    vehicles,
    launchSites,
    fetchedAt: new Date().toISOString(),
    source: {
      name: status.name,
      status: status.status,
      message: status.message,
    },
  };
}

export async function buildLaunchManifestPayload(force = false): Promise<LaunchManifestPayload> {
  if (!force) {
    const cached = getCached<LaunchManifestPayload>(CACHE_KEY);
    if (cached) return cached;
    return coalesceAsync('launch-manifest:build', () => buildLaunchManifestPayloadFresh(false));
  }

  return buildLaunchManifestPayloadFresh(true);
}

async function buildLaunchManifestPayloadFresh(force: boolean): Promise<LaunchManifestPayload> {
  if (!force) {
    const cached = getCached<LaunchManifestPayload>(CACHE_KEY);
    if (cached) return cached;
  }

  const { launches, status } = await fetchLaunches();
  const departures = buildDepartures(launches);
  const seedSites = buildSeedLaunchSites(departures);
  const seedVehicles = VEHICLE_SPECS as VehicleSpec[];

  const enrichment = await Promise.race([
    Promise.all([fetchLaunchSites(departures), fetchVehicleSpecs()]),
    delay(ENRICHMENT_BUDGET_MS).then(() => null),
  ]);

  const launchSites =
    enrichment && enrichment[0].length > 0 ? enrichment[0] : seedSites;
  const vehicles =
    enrichment && enrichment[1].length > 0 ? enrichment[1] : seedVehicles;

  const payload = mergeManifest(
    departures,
    launchSites,
    vehicles,
    status
  );

  setCache(CACHE_KEY, payload, CACHE_TTL_MS);
  return payload;
}
