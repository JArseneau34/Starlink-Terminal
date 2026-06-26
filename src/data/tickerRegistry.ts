/**
 * Display symbol → live market data symbol (Yahoo / Finnhub).
 * Use when the app ticker differs from the exchange listing.
 */
export const QUOTE_SYMBOL_OVERRIDES: Record<string, string> = {
  /** SES S.A. — Euronext SESG; US OTC USD line */
  SES: 'SGBAF',
};

/** Exchange labels for the company detail panel */
export const EXCHANGE_LABELS: Record<string, string> = {
  SPCX: 'NASDAQ',
  SES: 'OTC US · SGBAF (EPA: SESG)',
  RKLB: 'NASDAQ',
  LMT: 'NYSE',
  NOC: 'NYSE',
  BA: 'NYSE',
  PL: 'NYSE',
  ASTS: 'NASDAQ',
  IRDM: 'NASDAQ',
  SPCE: 'NYSE',
  BKSY: 'NYSE',
  RDW: 'NYSE',
  SATL: 'NASDAQ',
  LUNR: 'NASDAQ',
  MNTS: 'NASDAQ',
  LPTH: 'NASDAQ',
  SPIR: 'NYSE',
  VSAT: 'NASDAQ',
  GSAT: 'NYSE American',
  SATS: 'NASDAQ',
  RTX: 'NYSE',
  LHX: 'NYSE',
  KTOS: 'NASDAQ',
  GD: 'NYSE',
  MP: 'NYSE',
  UUUU: 'NYSE American',
  CCJ: 'NYSE',
  UEC: 'NYSE American',
  HXL: 'NYSE',
  ATI: 'NYSE',
  HWM: 'NYSE',
  CRS: 'NYSE',
  FCX: 'NYSE',
  ALB: 'NYSE',
  SQM: 'NYSE',
  KALU: 'NASDAQ',
  APD: 'NYSE',
  LIN: 'NASDAQ',
  NVDA: 'NASDAQ',
  AMD: 'NASDAQ',
  INTC: 'NASDAQ',
  MSFT: 'NASDAQ',
  GOOGL: 'NASDAQ',
  META: 'NASDAQ',
  AMZN: 'NASDAQ',
  ORCL: 'NYSE',
  CRM: 'NYSE',
  NOW: 'NYSE',
  SNOW: 'NYSE',
  PLTR: 'NASDAQ',
  AI: 'NYSE',
  PATH: 'NYSE',
  SOUN: 'NASDAQ',
  BBAI: 'NYSE',
};

/** Symbols with curated / simulated quotes — not fetched from market APIs */
export const SIMULATED_QUOTE_SYMBOLS = new Set<string>();

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function resolveQuoteSymbol(displaySymbol: string): string {
  const sym = normalizeSymbol(displaySymbol);
  return QUOTE_SYMBOL_OVERRIDES[sym] ?? sym;
}

export function getExchangeLabel(displaySymbol: string): string | undefined {
  return EXCHANGE_LABELS[normalizeSymbol(displaySymbol)];
}

export function isSimulatedQuoteSymbol(symbol: string): boolean {
  return SIMULATED_QUOTE_SYMBOLS.has(normalizeSymbol(symbol));
}

export function isQuoteTradable(symbol: string): boolean {
  return !isSimulatedQuoteSymbol(symbol);
}
