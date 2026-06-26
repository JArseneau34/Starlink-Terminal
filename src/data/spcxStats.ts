import type { Launch, NewsItem, StockQuote } from '../types';

export interface SpcxStat {
  label: string;
  value: string;
  sub?: string;
}

export interface VehicleRow {
  vehicle: string;
  status: string;
  flights: string;
  note: string;
}

export interface MilestoneRow {
  date: string;
  event: string;
  detail: string;
}

export const SPCX_IPO = {
  date: '2026-06-12',
  price: 135,
  day1Close: 161.24,
  week1Gain: 56.1,
  exchange: 'NASDAQ',
  sharesOffered: '412M',
  proceeds: '$55.6B',
};

export interface OhlcBar {
  label: string;
  date: string;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Daily OHLC since IPO — last bar updated from live quote when available. */
export const SPCX_DAILY_OHLC: OhlcBar[] = [
  {
    label: 'Jun 12',
    date: '2026-06-12',
    open: 135,
    high: 172.4,
    low: 134.2,
    close: 158.5,
    volume: 412_000_000,
  },
  {
    label: 'Jun 13',
    date: '2026-06-13',
    open: 159.2,
    high: 165.8,
    low: 152.1,
    close: 161.24,
    volume: 892_000_000,
  },
  {
    label: 'Jun 16',
    date: '2026-06-16',
    open: 162.5,
    high: 175.2,
    low: 160.8,
    close: 172.4,
    volume: 245_000_000,
  },
  {
    label: 'Jun 17',
    date: '2026-06-17',
    open: 173.1,
    high: 181.6,
    low: 169.4,
    close: 178.5,
    volume: 198_000_000,
  },
  {
    label: 'Jun 18',
    date: '2026-06-18',
    open: 177.2,
    high: 185.0,
    low: 174.8,
    close: 181.2,
    volume: 156_000_000,
  },
];

export function buildSpcxOhlcBars(
  quote?: Pick<StockQuote, 'price' | 'open' | 'high' | 'low' | 'volume'>
): OhlcBar[] {
  const bars = SPCX_DAILY_OHLC.map((b) => ({ ...b }));
  if (!quote?.price) return bars;

  const last = bars[bars.length - 1];
  if (!last) return bars;

  last.open = quote.open > 0 ? quote.open : last.open;
  last.high = Math.max(quote.high, last.high, quote.price);
  last.low = Math.min(quote.low, last.low, quote.price);
  last.close = quote.price;
  if (quote.volume > 0) last.volume = quote.volume;

  return bars;
}

export const SPCX_OPERATIONAL_STATS: SpcxStat[] = [
  { label: 'STARLINK SATS', value: '7,500+', sub: 'Active LEO constellation' },
  { label: 'LAUNCHES (2025)', value: '148', sub: 'Company record' },
  { label: 'LAUNCHES (2026 YTD)', value: '72', sub: 'Through Jun 16' },
  { label: 'FALCON 9 LANDINGS', value: '387', sub: 'Orbital class booster RTLS/ASDS' },
  { label: 'STARLINK SUBSCRIBERS', value: '6.2M+', sub: 'Residential + maritime + aviation' },
  { label: 'STARSHIP FLIGHTS', value: '8', sub: 'Integrated stack test program' },
  { label: 'DRAGON MISSIONS', value: '52', sub: 'Crew + cargo to ISS' },
  { label: 'EMPLOYEES', value: '13,000+', sub: 'Hawthorne HQ + sites' },
];

export const SPCX_VEHICLES: VehicleRow[] = [
  { vehicle: 'Falcon 9', status: 'ACTIVE', flights: '400+', note: 'Workhorse — Starlink + commercial + NASA' },
  { vehicle: 'Falcon Heavy', status: 'ACTIVE', flights: '11', note: 'DoD, USSF, interplanetary payloads' },
  { vehicle: 'Starship / Super Heavy', status: 'TEST', flights: '8', note: 'IFT-8 next — catch tower ops' },
  { vehicle: 'Dragon 2', status: 'ACTIVE', flights: '52', note: 'Crew-12 on station · Cargo resupply' },
  { vehicle: 'Starlink V2 Mini', status: 'DEPLOYING', flights: '—', note: 'Direct-to-cell capable sats' },
];

export const SPCX_MILESTONES: MilestoneRow[] = [
  { date: '2026-06-12', event: 'NASDAQ IPO', detail: 'SPCX lists at $135 — largest IPO in history' },
  { date: '2026-06-13', event: 'DAY 1 CLOSE', detail: 'Closes +19.4% at $161.24 on 892M volume' },
  { date: '2026-05-28', event: 'STARSHIP IFT-7', detail: 'Super Heavy booster caught at launch tower' },
  { date: '2026-04-18', event: 'STARLINK D2C', detail: 'Direct-to-cell service expands to 12 countries' },
  { date: '2026-03-14', event: 'CREW-12 LAUNCH', detail: 'Dragon docks ISS — 8th operational crew rotation' },
  { date: '2026-01-15', event: 'LAUNCH CADENCE', detail: 'Falcon 9 flies 3x in 24 hours — company first' },
];

const SPACEX_PATTERN = /spacex|starlink|falcon|starship|dragon|super heavy|crew-\d/i;

export function isSpaceXLaunch(launch: Launch): boolean {
  return SPACEX_PATTERN.test(launch.provider) || SPACEX_PATTERN.test(launch.name) || SPACEX_PATTERN.test(launch.rocket);
}

export function isSpaceXNews(item: NewsItem): boolean {
  return (
    item.relatedSymbols.includes('SPCX') ||
    SPACEX_PATTERN.test(item.headline) ||
    (item.summary ? SPACEX_PATTERN.test(item.summary) : false)
  );
}

export function filterSpaceXLaunches(launches: Launch[]): Launch[] {
  return launches.filter(isSpaceXLaunch);
}

export function filterSpaceXNews(news: NewsItem[]): NewsItem[] {
  return news.filter(isSpaceXNews);
}
