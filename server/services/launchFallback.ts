import type { Launch } from '../types.js';

interface FallbackTemplate {
  name: string;
  provider: string;
  rocket: string;
  pad: string;
  range: string;
  days: number;
  hours: number;
  status: string;
  probability: number;
  mission: string;
}

const TEMPLATES: FallbackTemplate[] = [
  {
    name: 'Starlink Group 12-18',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-40',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 1,
    hours: 6,
    status: 'Go for Launch',
    probability: 82,
    mission: 'Starlink broadband constellation deployment to low Earth orbit.',
  },
  {
    name: 'NROL-77',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-4E',
    range: 'Vandenberg SFB, CA, USA',
    days: 2,
    hours: 14,
    status: 'Go for Launch',
    probability: 75,
    mission: 'National reconnaissance payload for the National Reconnaissance Office.',
  },
  {
    name: 'Transporter-16',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-40',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 4,
    hours: 10,
    status: 'Scheduled',
    probability: 70,
    mission: 'Dedicated rideshare mission deploying multiple small satellites.',
  },
  {
    name: 'Kuiper (KA-01)',
    provider: 'Blue Origin',
    rocket: 'New Glenn',
    pad: 'LC-36A',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 6,
    hours: 18,
    status: 'Scheduled',
    probability: 65,
    mission: 'Project Kuiper prototype satellites to low Earth orbit.',
  },
  {
    name: 'Starlink Group 10-30',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-4E',
    range: 'Vandenberg SFB, CA, USA',
    days: 8,
    hours: 4,
    status: 'Scheduled',
    probability: 78,
    mission: 'Starlink shell replenishment from Vandenberg.',
  },
  {
    name: 'OneWeb Launch 21',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-40',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 10,
    hours: 22,
    status: 'Scheduled',
    probability: 72,
    mission: 'OneWeb broadband constellation batch deployment.',
  },
  {
    name: 'Electron | Tsukuyomi-1',
    provider: 'Rocket Lab',
    rocket: 'Electron',
    pad: 'LC-1A',
    range: 'Mahia Peninsula, New Zealand',
    days: 12,
    hours: 8,
    status: 'Go for Launch',
    probability: 68,
    mission: 'Dedicated small satellite launch for QPS Institute.',
  },
  {
    name: 'Ariane 6 | CSO-3',
    provider: 'Arianespace',
    rocket: 'Ariane 6',
    pad: 'ELA-4',
    range: 'Guiana Space Centre, French Guiana',
    days: 14,
    hours: 12,
    status: 'Scheduled',
    probability: 60,
    mission: 'French military optical reconnaissance satellite.',
  },
  {
    name: 'Vulcan VC2 | USSF-106',
    provider: 'ULA',
    rocket: 'Vulcan Centaur',
    pad: 'SLC-41',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 16,
    hours: 2,
    status: 'Scheduled',
    probability: 58,
    mission: 'U.S. Space Force national security mission.',
  },
  {
    name: 'Starlink Group 6-85',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-40',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 18,
    hours: 16,
    status: 'Scheduled',
    probability: 80,
    mission: 'Starlink direct-to-cell capable satellite batch.',
  },
  {
    name: 'Hera',
    provider: 'SpaceX',
    rocket: 'Falcon 9 Block 5',
    pad: 'SLC-40',
    range: 'Cape Canaveral SFS, FL, USA',
    days: 20,
    hours: 6,
    status: 'Scheduled',
    probability: 74,
    mission: 'ESA planetary defense mission to Didymos binary asteroid system.',
  },
  {
    name: 'LVM-3 | CMS-03',
    provider: 'ISRO',
    rocket: 'LVM-3',
    pad: 'Satish Dhawan FLP',
    range: 'Satish Dhawan Space Centre, India',
    days: 22,
    hours: 4,
    status: 'Scheduled',
    probability: 55,
    mission: 'Indian communications satellite to geostationary transfer orbit.',
  },
];

/** Synthetic upcoming schedule when LL2 is rate-limited or unreachable. */
export function getFallbackLaunches(): Launch[] {
  const now = Date.now();
  const dayMs = 86_400_000;

  return TEMPLATES.map((t, i) => {
    const date = new Date(now + t.days * dayMs + t.hours * 3_600_000);
    const location = `${t.pad}, ${t.range}`;

    return {
      id: `fallback-${i}-${date.toISOString().slice(0, 10)}`,
      name: t.name,
      provider: t.provider,
      rocket: t.rocket,
      location,
      pad: t.pad,
      range: t.range,
      date: date.toISOString(),
      status: t.status,
      mission: t.mission,
      probability: t.probability,
    };
  });
}
