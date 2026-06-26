import type { LaunchSite } from '../types/launchManifest';

/** Anchor coordinates for major ranges — used when LL2 is rate-limited. */
export const KNOWN_LAUNCH_SITES: Omit<LaunchSite, 'upcoming' | 'recent'>[] = [
  {
    id: 'seed-cape',
    name: 'Cape Canaveral SFS, FL, USA',
    latitude: 28.488889,
    longitude: -80.577778,
    countryCode: 'US',
    countryName: 'United States of America',
    activePadCount: 4,
    totalLaunchCount: 1100,
    pads: [
      { id: 'slc-40', name: 'SLC-40', latitude: 28.561941, longitude: -80.577357, totalLaunchCount: 387 },
      { id: 'slc-41', name: 'SLC-41', latitude: 28.58341, longitude: -80.583036, totalLaunchCount: 124 },
      { id: 'lc-39a', name: 'LC-39A', latitude: 28.608267, longitude: -80.604122, totalLaunchCount: 180 },
      { id: 'slc-37b', name: 'SLC-37B', latitude: 28.5317, longitude: -80.56495, totalLaunchCount: 40 },
    ],
  },
  {
    id: 'seed-kennedy',
    name: 'Kennedy Space Center, FL, USA',
    latitude: 28.524167,
    longitude: -80.650833,
    countryCode: 'US',
    countryName: 'United States of America',
    activePadCount: 2,
    totalLaunchCount: 200,
    pads: [
      { id: 'lc-39a-ks', name: 'LC-39A', latitude: 28.608267, longitude: -80.604122, totalLaunchCount: 180 },
      { id: 'lc-39b', name: 'LC-39B', latitude: 28.627222, longitude: -80.620833, totalLaunchCount: 55 },
    ],
  },
  {
    id: 'seed-vandenberg',
    name: 'Vandenberg SFB, CA, USA',
    latitude: 34.75133,
    longitude: -120.52023,
    countryCode: 'US',
    countryName: 'United States of America',
    activePadCount: 2,
    totalLaunchCount: 889,
    pads: [
      { id: 'slc-4e', name: 'SLC-4E', latitude: 34.632, longitude: -120.611, totalLaunchCount: 250 },
      { id: 'slc-6', name: 'SLC-6', latitude: 34.5815, longitude: -120.6262, totalLaunchCount: 14 },
    ],
  },
  {
    id: 'seed-mahia',
    name: 'Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand',
    latitude: -39.260833,
    longitude: 177.863056,
    countryCode: 'NZ',
    countryName: 'New Zealand',
    activePadCount: 2,
    totalLaunchCount: 55,
    pads: [
      { id: 'lc-1a', name: 'LC-1A', latitude: -39.260833, longitude: 177.863056, totalLaunchCount: 30 },
      { id: 'lc-1b', name: 'LC-1B', latitude: -39.255, longitude: 177.864, totalLaunchCount: 25 },
    ],
  },
  {
    id: 'seed-kourou',
    name: 'Guiana Space Centre, French Guiana',
    latitude: 5.169,
    longitude: -52.67,
    countryCode: 'GF',
    countryName: 'French Guiana',
    activePadCount: 2,
    totalLaunchCount: 320,
    pads: [
      { id: 'ela-4', name: 'ELA-4', latitude: 5.169, longitude: -52.67, totalLaunchCount: 5 },
      { id: 'ela-3', name: 'ELA-3', latitude: 5.236, longitude: -52.768, totalLaunchCount: 120 },
    ],
  },
  {
    id: 'seed-india',
    name: 'Satish Dhawan Space Centre, India',
    latitude: 13.7199,
    longitude: 80.2304,
    countryCode: 'IN',
    countryName: 'India',
    activePadCount: 2,
    totalLaunchCount: 95,
    pads: [
      { id: 'sdsc-flp', name: 'First Launch Pad', latitude: 13.7199, longitude: 80.2304, totalLaunchCount: 60 },
      { id: 'sdsc-slp', name: 'Second Launch Pad', latitude: 13.628, longitude: 80.228, totalLaunchCount: 35 },
    ],
  },
  {
    id: 'seed-wenchang',
    name: "Wenchang Space Launch Site, People's Republic of China",
    latitude: 19.614492,
    longitude: 110.951133,
    countryCode: 'CN',
    countryName: 'China',
    activePadCount: 2,
    totalLaunchCount: 64,
    pads: [
      { id: 'pad-201', name: 'Pad 201', latitude: 19.614492, longitude: 110.951133, totalLaunchCount: 40 },
    ],
  },
  {
    id: 'seed-baikonur',
    name: 'Baikonur Cosmodrome, Republic of Kazakhstan',
    latitude: 45.9644,
    longitude: 63.305,
    countryCode: 'KZ',
    countryName: 'Kazakhstan',
    activePadCount: 3,
    totalLaunchCount: 1500,
    pads: [
      { id: 'gagarin', name: 'Site 1/5', latitude: 45.92, longitude: 63.342, totalLaunchCount: 500 },
    ],
  },
  {
    id: 'seed-wallops',
    name: 'Wallops Flight Facility, Virginia, USA',
    latitude: 37.833,
    longitude: -75.488,
    countryCode: 'US',
    countryName: 'United States of America',
    activePadCount: 1,
    totalLaunchCount: 35,
    pads: [
      { id: 'lc-0a', name: 'LC-0A', latitude: 37.833, longitude: -75.488, totalLaunchCount: 20 },
    ],
  },
  {
    id: 'seed-tanegashima',
    name: 'Tanegashima Space Center, Japan',
    latitude: 30.4,
    longitude: 130.97,
    countryCode: 'JP',
    countryName: 'Japan',
    activePadCount: 2,
    totalLaunchCount: 70,
    pads: [
      { id: 'lp-1', name: 'LP-1', latitude: 30.4, longitude: 130.97, totalLaunchCount: 50 },
    ],
  },
];

export function cloneSeedSites(): LaunchSite[] {
  return KNOWN_LAUNCH_SITES.map((s) => ({
    ...s,
    pads: s.pads.map((p) => ({ ...p })),
    upcoming: [],
    recent: [],
  }));
}
