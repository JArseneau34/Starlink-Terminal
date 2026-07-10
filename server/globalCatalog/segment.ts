/** Heuristic space-segment classifier — ported from space_segment.py */

export const SEGMENT_COMMUNICATIONS = 'communications';
export const SEGMENT_EARTH_OBSERVATION = 'earth_observation';
export const SEGMENT_NAVIGATION = 'navigation';
export const SEGMENT_MILITARY = 'military';
export const SEGMENT_HUMAN_SPACEFLIGHT = 'human_spaceflight';
export const SEGMENT_SCIENCE = 'science';
export const SEGMENT_TECHNOLOGY = 'technology';
export const SEGMENT_OTHER = 'other';
export const SEGMENT_NON_PAYLOAD = 'non_payload';

export const SEGMENT_ORDER = [
  SEGMENT_COMMUNICATIONS,
  SEGMENT_EARTH_OBSERVATION,
  SEGMENT_NAVIGATION,
  SEGMENT_MILITARY,
  SEGMENT_HUMAN_SPACEFLIGHT,
  SEGMENT_SCIENCE,
  SEGMENT_TECHNOLOGY,
  SEGMENT_OTHER,
] as const;

export const SEGMENT_DISPLAY: Record<string, string> = {
  [SEGMENT_COMMUNICATIONS]: 'Communications',
  [SEGMENT_EARTH_OBSERVATION]: 'Earth Observation',
  [SEGMENT_NAVIGATION]: 'Navigation',
  [SEGMENT_MILITARY]: 'Military / Intelligence',
  [SEGMENT_HUMAN_SPACEFLIGHT]: 'Human Spaceflight',
  [SEGMENT_SCIENCE]: 'Science',
  [SEGMENT_TECHNOLOGY]: 'Technology Demo',
  [SEGMENT_OTHER]: 'Other / Unknown',
  [SEGMENT_NON_PAYLOAD]: 'Non-payload (debris / stage)',
};

export const MILITARY_OWNERS = new Set([
  'NRO', 'NROC', 'NRO/SAFSP', 'SAFSP', 'SAMSO', 'SDA', 'STP',
  'USAF', 'USSF', 'AFSPC', 'AFGSC', 'AFSSD', 'AFSMC',
  'AFSD', 'AFRL', 'USA', 'USN', 'NRL', 'MDA', 'DARPA', 'DOD',
  'HE360',
  'PVO', 'RVSN', 'RVSNR', 'VVKOV', 'VMF', 'GUKOSR', 'GUKOS', 'VVS',
  'OKVS', 'PKO', 'OSCC',
  'ZZB', 'PLA',
  'MOD', 'DGA',
  'IAF', 'DRDO',
  'MOD-IL', 'IDF',
]);

export const OWNER_TO_SEGMENT: Record<string, string> = {
  SWARM: SEGMENT_COMMUNICATIONS,
  SWARMX: SEGMENT_COMMUNICATIONS,
  ORBC: SEGMENT_COMMUNICATIONS,
  GLBSTR: SEGMENT_COMMUNICATIONS,
  INMAR: SEGMENT_COMMUNICATIONS,
  INTSAT: SEGMENT_COMMUNICATIONS,
  SES: SEGMENT_COMMUNICATIONS,
  EUTSAT: SEGMENT_COMMUNICATIONS,
  OWEB: SEGMENT_COMMUNICATIONS,
  IRIDS: SEGMENT_COMMUNICATIONS,
  CGSTL: SEGMENT_EARTH_OBSERVATION,
  YYAO: SEGMENT_EARTH_OBSERVATION,
  YUANX: SEGMENT_EARTH_OBSERVATION,
  GEESP: SEGMENT_EARTH_OBSERVATION,
  URUGUS: SEGMENT_EARTH_OBSERVATION,
  PLAN: SEGMENT_EARTH_OBSERVATION,
  SPIRE: SEGMENT_EARTH_OBSERVATION,
  ICEYE: SEGMENT_EARTH_OBSERVATION,
  CAPLA: SEGMENT_EARTH_OBSERVATION,
  UMBRA: SEGMENT_EARTH_OBSERVATION,
  BLACKSKY: SEGMENT_EARTH_OBSERVATION,
  GSFC: SEGMENT_SCIENCE,
  JPL: SEGMENT_SCIENCE,
  ARC: SEGMENT_SCIENCE,
  ESA: SEGMENT_SCIENCE,
  CNES: SEGMENT_SCIENCE,
  NASDA: SEGMENT_SCIENCE,
  JAXA: SEGMENT_SCIENCE,
  'IKI/BABTS': SEGMENT_SCIENCE,
  IKI: SEGMENT_SCIENCE,
  DLR: SEGMENT_SCIENCE,
  ASI: SEGMENT_SCIENCE,
  JSC: SEGMENT_HUMAN_SPACEFLIGHT,
};

const COMMUNICATIONS_KEYWORDS = [
  'starlink', 'oneweb', 'iridium', 'intelsat', 'globalstar', 'inmarsat',
  'ses-', 'ses ', 'astra', 'anik', 'telesat', 'telstar', 'echostar',
  'directv', 'viasat', 'hughes', 'thuraya', 'comstar', 'syncom',
  'westar', 'tdrs', 'yahsat', 'yamal', 'ekspress', 'raduga', 'molniya',
  'hispasat', 'amazonas', 'express-am', 'kuiper', 'nilesat', 'arabsat',
  'asiasat', 'chinasat', 'zhongxing', 'apstar', 'spaceway', 'satcom',
  'milsatcom', 'comsat', 'kacific', 'eutelsat', 'gonets', 'globus',
  'raduga-1', 'kondor', 'altius',
  'lemur', 'swarm-',
  'iridium next', 'iridium-', 'ses-17', "es'hail",
] as const;

const EARTH_OBSERVATION_KEYWORDS = [
  'landsat', 'sentinel', 'spot ', 'spot-', 'worldview', 'geoeye',
  'ikonos', 'quickbird', 'pleiades', 'rapideye', 'skysat', 'dove',
  'flock', 'terrasar', 'tandem-x', 'radarsat', 'envisat', 'ers-',
  'modis', 'viirs', 'noaa-', 'noaa n', 'metop', 'goes-', 'meteosat',
  'fengyun', 'feng yun', 'gaofen', 'yaogan', 'kanopus', 'resurs',
  'elektro', 'himawari', 'gosat', 'alos', 'ziyuan', 'ocean-',
  'haiyang', 'icesat', 'calipso', 'cloudsat', 'grace', 'smap',
  'swot', 'umbra-', 'capella', 'iceye', 'blacksky', 'spire',
  'axelspace', 'geooptics', 'cicero', 'weathernews', 'vrss',
  'jianbing',
] as const;

const NAVIGATION_KEYWORDS = [
  'gps ', 'gps-', 'navstar', 'galileo', 'glonass', 'beidou',
  'qzs', 'qzss', 'michibiki', 'irnss', 'navic', 'transit',
  'nts-', 'iiia', 'iiif',
] as const;

const MILITARY_KEYWORDS = [
  'milstar', 'aehf', 'wgs', 'dsp', 'sbirs', 'muos', 'keyhole',
  'kh-', 'corona', 'lacrosse', 'magnum', 'vortex', 'mentor',
  'trumpet', 'advanced orion', 'fia', 'topaz', 'nemesis',
  'rorsat', 'us-a', 'starshield', 'usa ', 'nrol',
  'argos', 'lapan', 'ofeq', 'ofek', 'tecsar', 'amos',
  'yaogan weixing', 'shijian-',
  'kosmos',
  'soyuz-r', 'tselina', 'us-p', 'us-pu', 'okean-o1',
] as const;

const HUMAN_SPACEFLIGHT_KEYWORDS = [
  'soyuz', 'shenzhou', 'apollo', 'gemini', 'mercury capsule',
  'crew dragon', 'starliner', 'iss ', 'tiangong', 'mir ',
  'salyut', 'skylab', 'progress', 'cygnus', 'htv', 'kounotori',
  'dragon crs', 'cargo dragon', 'vostok', 'voskhod', 'orion mpcv',
  'ariane crewed', 'axiom',
] as const;

const SCIENCE_KEYWORDS = [
  'hubble', 'kepler', 'tess', 'spitzer', 'webb', 'chandra',
  'swift', 'fermi', 'voyager', 'pioneer', 'explorer ',
  'explorer-', 'ulysses', 'cassini', 'juno', 'magellan',
  'viking', 'mars ', 'ranger ', 'surveyor', 'vela',
  'interball', 'geotail', 'themis', 'swarm', 'cluster',
  'soho', 'spektr', 'astron', 'granat', 'akari', 'hipparcos',
  'lisa', 'wmap', 'planck', 'gaia', 'euclid', 'ariel',
  'cheops', 'psyche', 'lucy', 'osiris-rex', 'dart',
  'perseverance', 'curiosity', 'ingenuity', 'lunar reconnaissance',
  'chandrayaan', 'mangalyaan', 'akatsuki', 'hayabusa',
  'rosetta', 'philae', 'new horizons', 'parker solar',
] as const;

const TECHNOLOGY_KEYWORDS = [
  'tech demo', 'techsat', 'experimental', 'test sat', 'demonstrat',
  'smallsat tech', 'rideshare demo', 'ion drive demo',
] as const;

type SatelliteRow = Record<string, string | number | null | undefined>;

function normalizeLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeUpper(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function anyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

export function classifySatelliteSegment(row: SatelliteRow): string {
  const objectType = normalizeUpper(row.object_type);
  if (!objectType.startsWith('P')) return SEGMENT_NON_PAYLOAD;

  const name = normalizeLower(row.name);
  const plName = normalizeLower(row.pl_name);
  const bus = normalizeLower(row.bus);
  const text = `${name} ${plName} ${bus}`;
  const owner = normalizeUpper(row.owner);
  const manufacturer = normalizeUpper(row.manufacturer);

  if (anyKeyword(text, HUMAN_SPACEFLIGHT_KEYWORDS)) return SEGMENT_HUMAN_SPACEFLIGHT;
  if (anyKeyword(text, NAVIGATION_KEYWORDS)) return SEGMENT_NAVIGATION;
  if (MILITARY_OWNERS.has(owner) || MILITARY_OWNERS.has(manufacturer)) return SEGMENT_MILITARY;
  if (anyKeyword(text, MILITARY_KEYWORDS)) return SEGMENT_MILITARY;
  if (anyKeyword(text, EARTH_OBSERVATION_KEYWORDS)) return SEGMENT_EARTH_OBSERVATION;
  if (anyKeyword(text, COMMUNICATIONS_KEYWORDS)) return SEGMENT_COMMUNICATIONS;
  if (anyKeyword(text, SCIENCE_KEYWORDS)) return SEGMENT_SCIENCE;
  if (anyKeyword(text, TECHNOLOGY_KEYWORDS)) return SEGMENT_TECHNOLOGY;
  if (owner in OWNER_TO_SEGMENT) return OWNER_TO_SEGMENT[owner]!;
  if (manufacturer in OWNER_TO_SEGMENT) return OWNER_TO_SEGMENT[manufacturer]!;
  return SEGMENT_OTHER;
}
