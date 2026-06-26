import { getCached, setCache } from '../cache.js';
import { fetchSpaceWeather, type SpaceWeatherPayload } from './orbitalSpaceWeather.js';

export interface OrbitalPayload {
  spaceWeather: SpaceWeatherPayload;
  fetchedAt: string;
}

const ORBITAL_CACHE_TTL = 30_000;
const ORBITAL_CACHE_KEY = 'orbital:space-weather';

export async function buildOrbitalPayload(): Promise<OrbitalPayload> {
  const cached = getCached<OrbitalPayload>(ORBITAL_CACHE_KEY);
  if (cached) return cached;

  const spaceWeather = await fetchSpaceWeather();

  const payload: OrbitalPayload = {
    spaceWeather,
    fetchedAt: new Date().toISOString(),
  };

  setCache(ORBITAL_CACHE_KEY, payload, ORBITAL_CACHE_TTL);
  return payload;
}
