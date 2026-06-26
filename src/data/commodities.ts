import type { Company, NewsItem } from '../types';

export type MaterialCategory =
  | 'rare-earth'
  | 'titanium'
  | 'lithium'
  | 'uranium'
  | 'copper'
  | 'carbon-fiber'
  | 'aluminum'
  | 'specialty-alloys'
  | 'industrial-gases';

export interface CommodityCompany extends Company {
  materialCategory: MaterialCategory;
  spaceApplication: string;
}

export interface MaterialIndexRow {
  material: string;
  category: MaterialCategory;
  spaceUse: string;
  demand: 'CRITICAL' | 'HIGH' | 'MODERATE';
  note: string;
}

export const COMMODITY_COMPANIES: CommodityCompany[] = [
  {
    id: 'mp-materials',
    symbol: 'MP',
    name: 'MP Materials',
    type: 'public',
    sector: 'Rare Earth Magnets',
    sectorTab: 'commodities',
    materialCategory: 'rare-earth',
    spaceApplication: 'NdFeB magnets in reaction wheels, actuators, and avionics motors',
    description:
      'Only scaled rare earth mining and processing operation in the Western Hemisphere. Mountain Pass supplies neodymium and praseodymium critical to satellite attitude control and launch vehicle electronics.',
    headquarters: 'Las Vegas, NV',
    founded: 2017,
    employees: '800+',
    keyMetrics: {
      'Mountain Pass': 'Active mine',
      'NdPr Output': 'Expanding',
      'Magnet Supply': 'Onshoring',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'uuuu',
    symbol: 'UUUU',
    name: 'Energy Fuels',
    type: 'public',
    sector: 'Uranium & Rare Earth',
    sectorTab: 'commodities',
    materialCategory: 'uranium',
    spaceApplication: 'Uranium for RTGs; rare earth processing for defense and space supply chains',
    description:
      'Leading US uranium producer with White Mesa mill. Expanding into rare earth separation — dual exposure to space nuclear power and magnet supply chains.',
    headquarters: 'Lakewood, CO',
    founded: 1987,
    employees: '400+',
    keyMetrics: {
      'Uranium': 'US producer',
      'White Mesa Mill': 'Operating',
      'Rare Earths': 'Processing',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'ccj',
    symbol: 'CCJ',
    name: 'Cameco',
    type: 'public',
    sector: 'Uranium Mining',
    sectorTab: 'commodities',
    materialCategory: 'uranium',
    spaceApplication: 'U-238 and Pu-238 feedstock for radioisotope thermoelectric generators (RTGs)',
    description:
      'World\'s largest publicly traded uranium company. Supplies nuclear fuel globally; RTG isotopes power deep-space missions including Mars rovers and outer planet probes.',
    headquarters: 'Saskatoon, SK',
    founded: 1988,
    employees: '2,600+',
    keyMetrics: {
      'Uranium Reserves': 'Tier-1',
      'Cigar Lake': 'High grade',
      'RTG Supply Chain': 'Indirect',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'uec',
    symbol: 'UEC',
    name: 'Uranium Energy',
    type: 'public',
    sector: 'Uranium Mining',
    sectorTab: 'commodities',
    materialCategory: 'uranium',
    spaceApplication: 'Domestic uranium for space nuclear R&D and future fission surface power',
    description:
      'US-focused uranium developer and producer. Benefits from space nuclear propulsion and lunar surface power initiatives requiring domestic fuel supply.',
    headquarters: 'Corpus Christi, TX',
    founded: 2003,
    employees: '150+',
    keyMetrics: {
      'US Assets': 'Wyoming, Texas',
      'Hub-and-Spoke': 'ISR mining',
      'Space Nuclear': 'Policy tailwind',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'hxl',
    symbol: 'HXL',
    name: 'Hexcel',
    type: 'public',
    sector: 'Carbon Fiber Composites',
    sectorTab: 'commodities',
    materialCategory: 'carbon-fiber',
    spaceApplication: 'Carbon fiber prepreg for fairings, interstages, payload adapters, and satellite structures',
    description:
      'Leading advanced composites supplier. HexTow carbon fiber and HexPly prepregs used in rocket bodies, fairings, and lightweight satellite bus structures.',
    headquarters: 'Stamford, CT',
    founded: 1946,
    employees: '5,700+',
    keyMetrics: {
      'HexTow Fiber': 'Industry standard',
      'Aerospace Mix': '~85%',
      'Launch Exposure': 'HIGH',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'ati',
    symbol: 'ATI',
    name: 'ATI Inc',
    type: 'public',
    sector: 'Titanium & Specialty Alloys',
    sectorTab: 'commodities',
    materialCategory: 'titanium',
    spaceApplication: 'Ti-6Al-4V for engine components, propellant tanks, and structural forgings',
    description:
      'Produces titanium mill products and nickel-based superalloys for aerospace and defense. Key supplier for rocket engine hardware and pressure vessels.',
    headquarters: 'Dallas, TX',
    founded: 1996,
    employees: '6,000+',
    keyMetrics: {
      'Titanium': 'Mill products',
      'Nickel Alloys': 'Engine grade',
      'A&D Revenue': 'Majority',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'hwm',
    symbol: 'HWM',
    name: 'Howmet Aerospace',
    type: 'public',
    sector: 'Engineered Fasteners & Forgings',
    sectorTab: 'commodities',
    materialCategory: 'titanium',
    spaceApplication: 'Titanium and superalloy fasteners, rings, and forgings for launch vehicles',
    description:
      'Manufactures aerospace fasteners, engine rings, and forged titanium components. Supplies critical hardware for rocket engines and airframe structures.',
    headquarters: 'Pittsburgh, PA',
    founded: 1888,
    employees: '23,000+',
    keyMetrics: {
      'Fasteners': 'Global leader',
      'Titanium Forgings': 'Active',
      'Engine Rings': 'Rocket grade',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'crs',
    symbol: 'CRS',
    name: 'Carpenter Technology',
    type: 'public',
    sector: 'Specialty Alloys',
    sectorTab: 'commodities',
    materialCategory: 'specialty-alloys',
    spaceApplication: 'Vacuum-melted superalloys and powder metals for rocket engine turbopumps',
    description:
      'Produces premium specialty alloys including nickel superalloys for extreme temperature applications in rocket engines and turbine components.',
    headquarters: 'Wyomissing, PA',
    founded: 1889,
    employees: '4,500+',
    keyMetrics: {
      'Superalloys': 'Vacuum arc remelt',
      'Powder Metals': 'AM-ready',
      'Aerospace': 'Core end market',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'fcx',
    symbol: 'FCX',
    name: 'Freeport-McMoRan',
    type: 'public',
    sector: 'Copper Mining',
    sectorTab: 'commodities',
    materialCategory: 'copper',
    spaceApplication: 'High-conductivity copper for avionics wiring, RF systems, and ground segment infrastructure',
    description:
      'World\'s largest publicly traded copper producer. Copper intensity rises with satellite constellation scale — wiring harnesses, RF payloads, and launch pad infrastructure.',
    headquarters: 'Phoenix, AZ',
    founded: 1912,
    employees: '28,000+',
    keyMetrics: {
      'Copper Output': '3.6B+ lbs/yr',
      'Grasberg': 'Tier-1 asset',
      'EV + Space': 'Demand driver',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'alb',
    symbol: 'ALB',
    name: 'Albemarle',
    type: 'public',
    sector: 'Lithium & Specialty Chemicals',
    sectorTab: 'commodities',
    materialCategory: 'lithium',
    spaceApplication: 'Lithium-ion cells for satellite buses, ground support equipment, and launch vehicle avionics',
    description:
      'Global leader in lithium production and refining. Satellite power systems and portable ground equipment depend on stable lithium chemical supply.',
    headquarters: 'Charlotte, NC',
    founded: 1994,
    employees: '9,000+',
    keyMetrics: {
      'Lithium': 'Global #1',
      'Brine + Hard Rock': 'Diversified',
      'Battery Grade': 'Qualified',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'sqm',
    symbol: 'SQM',
    name: 'Sociedad Química y Minera',
    type: 'public',
    sector: 'Lithium & Iodine',
    sectorTab: 'commodities',
    materialCategory: 'lithium',
    spaceApplication: 'Lithium carbonate and hydroxide for satellite battery supply chains',
    description:
      'Major lithium producer from Chilean brine operations. Supplies battery-grade lithium compounds used in spacecraft energy storage systems.',
    headquarters: 'Santiago, Chile',
    founded: 1968,
    employees: '7,000+',
    keyMetrics: {
      'Lithium Brine': 'Atacama',
      'Market Share': 'Top tier',
      'Iodine': 'Also supplies',
      'Space Exposure': 'MODERATE',
    },
  },
  {
    id: 'kalu',
    symbol: 'KALU',
    name: 'Kaiser Aluminum',
    type: 'public',
    sector: 'Aluminum Plate & Extrusions',
    sectorTab: 'commodities',
    materialCategory: 'aluminum',
    spaceApplication: 'Aluminum-lithium plate for tank domes, intertank structures, and launch vehicle skins',
    description:
      'Produces aerospace-grade aluminum plate and extrusions. Aluminum-lithium alloys reduce weight in rocket tank structures and satellite frames.',
    headquarters: 'Foothill Ranch, CA',
    founded: 1946,
    employees: '3,800+',
    keyMetrics: {
      'Aero Plate': 'Qualified supplier',
      'Al-Li Alloys': 'Lightweight tanks',
      'Defense Mix': 'Significant',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'apd',
    symbol: 'APD',
    name: 'Air Products',
    type: 'public',
    sector: 'Industrial Gases',
    sectorTab: 'commodities',
    materialCategory: 'industrial-gases',
    spaceApplication: 'Liquid oxygen, nitrogen, and helium for propellant loading, purge systems, and manufacturing',
    description:
      'Supplies cryogenic gases for rocket propellant handling, pad operations, and clean-room manufacturing. Helium used in pressurization and purge systems.',
    headquarters: 'Allentown, PA',
    founded: 1940,
    employees: '23,000+',
    keyMetrics: {
      'Cryogenics': 'LOX/LN2 supply',
      'Helium': 'Pressurization',
      'Launch Pads': 'Infrastructure',
      'Space Exposure': 'HIGH',
    },
  },
  {
    id: 'lin',
    symbol: 'LIN',
    name: 'Linde',
    type: 'public',
    sector: 'Industrial Gases',
    sectorTab: 'commodities',
    materialCategory: 'industrial-gases',
    spaceApplication: 'Industrial gas supply for rocket test stands, welding, and composite curing',
    description:
      'Global industrial gases leader. Supports rocket engine test facilities, composite autoclave operations, and launch site cryogenic infrastructure worldwide.',
    headquarters: 'Guildford, UK',
    founded: 1879,
    employees: '65,000+',
    keyMetrics: {
      'Global Gases': '#1 or #2',
      'Cryogenics': 'Launch sites',
      'Hydrogen': 'Green propellant',
      'Space Exposure': 'MODERATE',
    },
  },
];

export const COMMODITY_SYMBOLS = COMMODITY_COMPANIES
  .filter((c) => c.type === 'public')
  .map((c) => c.symbol);

export const MATERIAL_INDEX: MaterialIndexRow[] = [
  {
    material: 'Titanium (Ti-6Al-4V)',
    category: 'titanium',
    spaceUse: 'Engine components, propellant tanks, structural forgings',
    demand: 'CRITICAL',
    note: 'Limited Western supply; long aerospace qual cycles',
  },
  {
    material: 'Nickel Superalloys (Inconel)',
    category: 'specialty-alloys',
    spaceUse: 'Combustion chambers, turbopumps, nozzle extensions',
    demand: 'CRITICAL',
    note: 'Vacuum-melted grades; extreme temperature tolerance',
  },
  {
    material: 'Carbon Fiber Prepreg',
    category: 'carbon-fiber',
    spaceUse: 'Fairings, interstages, payload adapters, sat structures',
    demand: 'HIGH',
    note: 'PAN-based fiber; autoclave and OOA curing',
  },
  {
    material: 'Aluminum-Lithium',
    category: 'aluminum',
    spaceUse: 'Tank domes, intertank rings, launch vehicle skins',
    demand: 'HIGH',
    note: 'Weight savings vs conventional Al alloys',
  },
  {
    material: 'Neodymium / Praseodymium',
    category: 'rare-earth',
    spaceUse: 'Reaction wheels, solar array drives, valve actuators',
    demand: 'CRITICAL',
    note: 'China-dominated refining; US onshoring underway',
  },
  {
    material: 'Copper (Aerospace grade)',
    category: 'copper',
    spaceUse: 'Avionics wiring, RF payloads, ground segment',
    demand: 'HIGH',
    note: 'Constellation scale drives volume intensity',
  },
  {
    material: 'Lithium Compounds',
    category: 'lithium',
    spaceUse: 'Satellite bus batteries, GSE, portable systems',
    demand: 'MODERATE',
    note: 'Battery-grade carbonate and hydroxide',
  },
  {
    material: 'Uranium / Pu-238',
    category: 'uranium',
    spaceUse: 'RTGs for deep space; future fission surface power',
    demand: 'MODERATE',
    note: 'NASA DOE partnership for Pu-238 restart',
  },
  {
    material: 'Liquid Oxygen / Nitrogen',
    category: 'industrial-gases',
    spaceUse: 'Propellant loading, purge, pad operations',
    demand: 'CRITICAL',
    note: 'Every orbital launch requires cryogenic supply',
  },
  {
    material: 'Helium',
    category: 'industrial-gases',
    spaceUse: 'Tank pressurization, purge, leak detection',
    demand: 'HIGH',
    note: 'Supply constraints affect launch cadence',
  },
];

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  'rare-earth': 'RARE EARTH',
  titanium: 'TITANIUM',
  lithium: 'LITHIUM',
  uranium: 'URANIUM',
  copper: 'COPPER',
  'carbon-fiber': 'CARBON FIBER',
  aluminum: 'ALUMINUM',
  'specialty-alloys': 'SPECIALTY ALLOYS',
  'industrial-gases': 'INDUSTRIAL GASES',
};

export function getCategoryLabel(category: MaterialCategory): string {
  return CATEGORY_LABELS[category];
}

export function getCommodityBySymbol(symbol: string): CommodityCompany | undefined {
  return COMMODITY_COMPANIES.find(
    (c) => c.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

const COMMODITY_NEWS_PATTERN =
  /rare earth|uranium|lithium|titanium|copper|carbon fiber|composite|superalloy|aluminum|aluminium|hexcel|cameco|mp materials|freeport|albemarle|industrial gas|cryogenic|propellant|rtg\b|radioisotope|neodymium|magnet supply|critical mineral/i;

const SYMBOL_NEWS_MAP: Record<string, RegExp> = {
  MP: /mp materials|mountain pass|rare earth|neodymium/i,
  UUUU: /energy fuels|white mesa/i,
  CCJ: /cameco|uranium/i,
  UEC: /uranium energy/i,
  HXL: /hexcel|carbon fiber|composite prepreg/i,
  ATI: /\bati inc\b|titanium mill/i,
  HWM: /howmet|aerospace fastener/i,
  CRS: /carpenter technology|superalloy/i,
  FCX: /freeport|copper mine|copper price/i,
  ALB: /albemarle|lithium/i,
  SQM: /\bsqm\b|sociedad quimica|lithium brine/i,
  KALU: /kaiser aluminum/i,
  APD: /air products|industrial gas|cryogenic/i,
  LIN: /\blinde\b|industrial gas/i,
};

export function isCommodityNews(item: NewsItem): boolean {
  if (item.relatedSymbols.some((s) => COMMODITY_SYMBOLS.includes(s))) return true;
  const text = `${item.headline} ${item.summary ?? ''}`;
  if (COMMODITY_NEWS_PATTERN.test(text)) return true;
  return COMMODITY_COMPANIES.some((c) => SYMBOL_NEWS_MAP[c.symbol]?.test(text));
}

export function filterCommodityNews(news: NewsItem[]): NewsItem[] {
  return news.filter(isCommodityNews);
}

export function tagCommoditySymbols(text: string): string[] {
  const symbols = new Set<string>();
  for (const company of COMMODITY_COMPANIES) {
    const pattern = SYMBOL_NEWS_MAP[company.symbol];
    if (pattern?.test(text)) symbols.add(company.symbol);
  }
  if (COMMODITY_NEWS_PATTERN.test(text)) {
    for (const company of COMMODITY_COMPANIES) {
      if (new RegExp(company.name.split(' ')[0], 'i').test(text)) {
        symbols.add(company.symbol);
      }
    }
  }
  return Array.from(symbols);
}
