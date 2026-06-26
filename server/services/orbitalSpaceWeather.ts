const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const EVENTS_URL = 'https://services.swpc.noaa.gov/json/edited_events.json';
const FLARES_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json';

export interface KpReading {
  time: string;
  kp: number;
  aRunning: number;
}

export interface SolarWindReading {
  time: string;
  speedKms: number;
  density: number;
}

export interface AuroraBoundaryPoint {
  lon: number;
  lat: number;
}

export interface AuroraOval {
  observationTime: string;
  forecastTime: string;
  north: AuroraBoundaryPoint[];
  south: AuroraBoundaryPoint[];
  maxNorthLat: number;
  maxSouthLat: number;
}

export interface SolarFlareEvent {
  time: string;
  classLabel: string;
  region: number | null;
  observatory: string;
}

export interface SpaceWeatherPayload {
  kp: KpReading | null;
  kpHistory: KpReading[];
  solarWind: SolarWindReading | null;
  aurora: AuroraOval | null;
  flares: SolarFlareEvent[];
  fetchedAt: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseKp(data: unknown): { current: KpReading | null; history: KpReading[] } {
  if (!Array.isArray(data) || data.length < 2) return { current: null, history: [] };

  const rows = data.slice(1) as Array<{ time_tag: string; Kp: string; a_running: string }>;
  const history = rows.slice(-8).map((r) => ({
    time: r.time_tag,
    kp: Number(r.Kp),
    aRunning: Number(r.a_running),
  }));

  return { current: history[history.length - 1] ?? null, history };
}

function parsePlasma(data: unknown): SolarWindReading | null {
  if (!Array.isArray(data) || data.length < 2) return null;
  const last = data[data.length - 1] as string[];
  if (!last || last.length < 3) return null;

  return {
    time: last[0]!,
    density: Number(last[1]),
    speedKms: Number(last[2]),
  };
}

function parseAurora(data: unknown): AuroraOval | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as {
    'Observation Time'?: string;
    'Forecast Time'?: string;
    coordinates?: [number, number, number][];
  };

  const coords = d.coordinates;
  if (!coords?.length) return null;

  const THRESHOLD = 12;
  const northByLon = new Map<number, number>();
  const southByLon = new Map<number, number>();

  for (const [lon, lat, intensity] of coords) {
    if (intensity < THRESHOLD) continue;
    if (lat > 0) {
      const prev = northByLon.get(lon) ?? -90;
      if (lat > prev) northByLon.set(lon, lat);
    } else if (lat < 0) {
      const prev = southByLon.get(lon) ?? 90;
      if (lat < prev) southByLon.set(lon, lat);
    }
  }

  const north: AuroraBoundaryPoint[] = [...northByLon.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lon, lat]) => ({ lon, lat }));
  const south: AuroraBoundaryPoint[] = [...southByLon.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lon, lat]) => ({ lon, lat }));

  return {
    observationTime: d['Observation Time'] ?? '',
    forecastTime: d['Forecast Time'] ?? '',
    north,
    south,
    maxNorthLat: north.length ? Math.max(...north.map((p) => p.lat)) : 0,
    maxSouthLat: south.length ? Math.min(...south.map((p) => p.lat)) : 0,
  };
}

function parseFlares(events: unknown, latest: unknown): SolarFlareEvent[] {
  const out: SolarFlareEvent[] = [];
  const seen = new Set<string>();

  if (Array.isArray(events)) {
    const cutoff = Date.now() - 14 * 24 * 3_600_000;
    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const e = raw as {
        type?: string;
        particulars1?: string;
        max_datetime?: string;
        begin_datetime?: string;
        region?: number;
        observatory?: string;
      };

      if (e.type !== 'XRA') continue;
      const label = e.particulars1 ?? '';
      if (!/^[XM]\d/i.test(label)) continue;

      const time = e.max_datetime ?? e.begin_datetime;
      if (!time || new Date(time).getTime() < cutoff) continue;

      const key = `${time}-${label}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        time,
        classLabel: label.toUpperCase(),
        region: e.region ?? null,
        observatory: e.observatory ?? 'GOES',
      });
    }
  }

  out.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (Array.isArray(latest) && latest[0]) {
    const f = latest[0] as {
      max_class?: string;
      max_time?: string;
      begin_class?: string;
    };
    const label = (f.max_class ?? f.begin_class ?? '').toUpperCase();
    if (/^[XM]/.test(label) && f.max_time) {
      const key = `${f.max_time}-${label}`;
      if (!seen.has(key)) {
        out.unshift({
          time: f.max_time,
          classLabel: label,
          region: null,
          observatory: 'GOES',
        });
      }
    }
  }

  return out.slice(0, 8);
}

export async function fetchSpaceWeather(): Promise<SpaceWeatherPayload> {
  const [kpData, plasmaData, auroraData, eventsData, flareLatest] = await Promise.all([
    fetchJson<unknown>(KP_URL),
    fetchJson<unknown>(PLASMA_URL),
    fetchJson<unknown>(AURORA_URL),
    fetchJson<unknown>(EVENTS_URL),
    fetchJson<unknown>(FLARES_URL),
  ]);

  const { current, history } = parseKp(kpData);

  return {
    kp: current,
    kpHistory: history,
    solarWind: parsePlasma(plasmaData),
    aurora: parseAurora(auroraData),
    flares: parseFlares(eventsData, flareLatest),
    fetchedAt: new Date().toISOString(),
  };
}
