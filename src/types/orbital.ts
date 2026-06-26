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

export interface OrbitalPayload {
  spaceWeather: SpaceWeatherPayload;
  fetchedAt: string;
}

export interface DebrisObject {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  inclination: number;
  epoch: string;
}

export interface AltitudeBand {
  minKm: number;
  maxKm: number;
  label: string;
  count: number;
  densityIndex: number;
}

export interface ConjunctionAlert {
  id: string;
  primaryName: string;
  primaryNorad: number;
  secondaryName: string;
  secondaryNorad: number;
  minRangeKm: number;
  probability: number;
  tca: string;
  relativeSpeedKms: number;
  primaryLat: number;
  primaryLon: number;
  primaryAltKm: number;
  secondaryLat: number;
  secondaryLon: number;
  secondaryAltKm: number;
}

export interface ReentryForecast {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  windowStart: string;
  windowEnd: string;
  perigeeKm: number;
  inclination: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SsaPayload {
  debris: DebrisObject[];
  otherObjects: DebrisObject[];
  densityBands: AltitudeBand[];
  conjunctions: ConjunctionAlert[];
  reentries: ReentryForecast[];
  fetchedAt: string;
}

export interface StarlinkSatMeta {
  noradId: number;
  name: string;
  objectId: string | null;
  launchBatch: string | null;
  inclination: number;
  shell: number;
  shellName: string;
  perigeeKm: number;
  apogeeKm: number;
  eccentricity: number;
  lifecycle: StarlinkLifecycle;
  r: number;
  g: number;
  b: number;
  epoch: string;
}

export interface StarlinkCatalogPayload {
  count: number;
  referenceTime: string;
  tleFetchedAt: string;
  satellites: StarlinkSatMeta[];
  lat: number[];
  lon: number[];
  altKm: number[];
  velLat: number[];
  velLon: number[];
  velAlt: number[];
  /** Compact OMM elements for client SGP4; parallel to satellites[]. */
  ommMeanMotion?: number[];
  ommRaan?: number[];
  ommArgPerigee?: number[];
  ommMeanAnomaly?: number[];
  ommBstar?: number[];
  ommMeanMotionDot?: number[];
  ommMeanMotionDdot?: number[];
  ommElementSetNo?: number[];
  fetchedAt: string;
}

/** Client catalog poll interval — server re-propagates from cached TLE on this cadence. */
export const STARLINK_CATALOG_REFRESH_MS = 20_000;

export type StarlinkLifecycle = 'operational' | 'raising' | 'deorbiting' | 'other';

export interface StarlinkShellStats {
  name: string;
  inclination: number;
  count: number;
  operational: number;
  raising: number;
  deorbiting: number;
  meanAltitudeKm: number;
}

export interface StarlinkRecentLaunch {
  intlDesignator: string;
  satelliteCount: number;
  dominantShell: string;
}

export interface StarlinkIntelPayload {
  totalTracked: number;
  ephemerisPublished: number;
  lifecycle: Record<StarlinkLifecycle, number>;
  shells: StarlinkShellStats[];
  medianEpochAgeHours: number;
  staleTleCount: number;
  launchedYtd: number;
  recentLaunches: StarlinkRecentLaunch[];
  tleFetchedAt: string;
  fetchedAt: string;
}

export interface StarlinkSatelliteDetail {
  noradId: number;
  name: string;
  objectId: string | null;
  launchBatch: string | null;
  shellName: string;
  inclination: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  perigeeKm: number;
  apogeeKm: number;
  eccentricity: number;
  lifecycle: StarlinkLifecycle;
  groundSpeedKms: number;
  verticalSpeedKms: number;
  epoch: string;
  epochAgeHours: number;
  referenceTime: string;
}

export type StarlinkMeshMode = 'topology' | 'live';
