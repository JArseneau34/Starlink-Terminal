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
  modelHint: StarlinkModelHint;
  r: number;
  g: number;
  b: number;
  epoch: string;
}

export interface StarlinkCatalogShell {
  index: number;
  name: string;
  inclination: number;
  count: number;
  color: number;
}

export type StarlinkTleSource = 'group' | 'name' | 'tleapi' | 'cache';

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
  shells: StarlinkCatalogShell[];
  tleSource: StarlinkTleSource;
  /** True when upstream fetch failed and stale cache is being served. */
  tleOffline?: boolean;
  fetchedAt: string;
}

/** Client catalog poll interval — server re-propagates from cached TLE on this cadence. */
export const STARLINK_CATALOG_REFRESH_MS = 20_000;

export type StarlinkLifecycle = 'operational' | 'raising' | 'deorbiting' | 'other';

export type StarlinkModelHint =
  | 'v1'
  | 'v15'
  | 'v2Mini'
  | 'v2MiniDtc'
  | 'v2MiniOpt'
  | 'unknown';

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

export interface StarlinkFleetModelCounts {
  v1: number;
  v15: number;
  v2Mini: number;
  v2MiniD2c: number;
  v2MiniOpt: number;
}

export interface StarlinkFleetReconciliation {
  tleTracked: number;
  delta: number;
  note: string;
}

export interface StarlinkFleetAuthoritative {
  totalInOrbit: number;
  totalWorking: number;
  totalDown: number;
  snapshotDate: string;
  models: StarlinkFleetModelCounts;
  bandwidthTbps: number;
  reconciliation: StarlinkFleetReconciliation;
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
  authoritative: StarlinkFleetAuthoritative;
  /** False when the live CelesTrak TLE feed was unreachable and the payload is snapshot-only. */
  liveTleAvailable: boolean;
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
