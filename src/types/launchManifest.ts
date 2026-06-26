export interface SlipEvent {
  date: string;
  reason: string;
  deltaDays: number;
}

export interface ManifestDeparture {
  id: string;
  flight: string;
  provider: string;
  vehicle: string;
  pad: string;
  range: string;
  net: string;
  status: string;
  mission?: string;
  weatherScrubPct: number;
  slipCount: number;
  slipHistory: SlipEvent[];
}

export interface CostPerKgPoint {
  date: string;
  label: string;
  usdPerKg: number;
  benchmark: string;
}

export interface CostPerKgIndex {
  spot: number;
  changePct30d: number;
  changePctYtd: number;
  series: CostPerKgPoint[];
}

export interface PadSlot {
  launchId: string;
  flight: string;
  provider: string;
  vehicle: string;
  net: string;
  status: string;
}

export interface PadContentionDay {
  date: string;
  label: string;
  pads: Record<string, PadSlot[]>;
}

export interface VehicleSpec {
  id: string;
  vehicle: string;
  provider: string;
  payloadLeoKg: number;
  payloadGtoKg: number;
  payloadTliKg: number;
  reusable: string;
  fairingVolumeM3: number;
  costPerKgLeo: number;
  status: string;
  thrustKn?: number | null;
  heightM?: number | null;
  diameterM?: number | null;
  reusableBool?: boolean | null;
  ll2Id?: number;
}

export interface LaunchSiteActivity {
  id: string;
  name: string;
  vehicle: string;
  provider: string;
  net: string;
  status: string;
  padName: string;
}

export interface LaunchPadMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  totalLaunchCount: number;
}

export interface LaunchSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  countryName: string;
  activePadCount: number;
  totalLaunchCount: number;
  pads: LaunchPadMarker[];
  upcoming: LaunchSiteActivity[];
  recent: LaunchSiteActivity[];
}

export interface LaunchManifestPayload {
  departures: ManifestDeparture[];
  costIndex: CostPerKgIndex;
  padCalendar: PadContentionDay[];
  vehicles: VehicleSpec[];
  launchSites: LaunchSite[];
  fetchedAt: string;
  source?: {
    name: string;
    status: 'ok' | 'degraded' | 'error' | 'cached' | 'seed';
    message?: string;
  };
}
