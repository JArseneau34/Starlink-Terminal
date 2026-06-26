export type CompanyType = 'public' | 'private';

export type SectorTab =
  | 'all'
  | 'launch'
  | 'satcom'
  | 'earth-obs'
  | 'defense'
  | 'infrastructure'
  | 'tourism'
  | 'commodities'
  | 'ai';

export interface Company {
  id: string;
  symbol: string;
  name: string;
  type: CompanyType;
  sector: string;
  sectorTab: SectorTab;
  description: string;
  headquarters: string;
  founded: number;
  valuation?: string;
  employees?: string;
  ipoDate?: string;
  ipoPrice?: number;
  keyMetrics?: Record<string, string>;
}

export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  lastUpdated: Date;
  source?: string;
  session?: MarketSession;
  regularPrice?: number;
  extendedPrice?: number;
}

export interface Launch {
  id: string;
  name: string;
  provider: string;
  rocket: string;
  location: string;
  date: Date;
  status: string;
  mission?: string;
  success?: boolean;
  pad?: string;
  range?: string;
  probability?: number | null;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: Date;
  category: string;
  relatedSymbols: string[];
  sectorTab?: SectorTab;
  url?: string;
  summary?: string;
  sentiment?: number;
  provider?: 'finnhub' | 'snapi' | 'marketaux';
  imageUrl?: string;
}

export interface DataSourceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'error' | 'cached' | 'seed';
  lastFetch: string | null;
  message?: string;
}

export interface MarketStats {
  totalMarketCap: number;
  avgChangePercent: number;
  launchesYTD: number;
  upcomingLaunches: number;
  activeSatellites: string;
  governmentSpending: string;
}

export interface UserSettings {
  refreshInterval: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  refreshInterval: 60,
};
