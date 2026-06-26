import type { NewsItem, SectorTab } from '../../types.js';

const SYMBOL_RULES: Array<{
  pattern: RegExp;
  symbols: string[];
  sector?: SectorTab;
  category: string;
}> = [
  { pattern: /spacex|starlink|falcon|starship|spcx/i, symbols: ['SPCX'], sector: 'launch', category: 'LAUNCH' },
  { pattern: /rocket lab|electron|neutron/i, symbols: ['RKLB'], sector: 'launch', category: 'LAUNCH' },
  { pattern: /blue origin|new glenn|new shepard/i, symbols: ['BLUE'], sector: 'launch', category: 'LAUNCH' },
  { pattern: /virgin galactic|spaceshiptwo/i, symbols: ['SPCE'], sector: 'tourism', category: 'TOURISM' },
  { pattern: /planet labs|planet\s+pbc/i, symbols: ['PL'], sector: 'earth-obs', category: 'EARNINGS' },
  { pattern: /blacksky/i, symbols: ['BKSY'], sector: 'earth-obs', category: 'TECH' },
  { pattern: /satellogic/i, symbols: ['SATL'], sector: 'earth-obs', category: 'TECH' },
  { pattern: /ast spacemobile|bluebird/i, symbols: ['ASTS'], sector: 'satcom', category: 'TECH' },
  { pattern: /iridium/i, symbols: ['IRDM'], sector: 'satcom', category: 'TELECOM' },
  { pattern: /lockheed|ula|vulcan centaur/i, symbols: ['LMT'], sector: 'defense', category: 'GOVT' },
  { pattern: /northrop|cygnus|antares/i, symbols: ['NOC'], sector: 'defense', category: 'GOVT' },
  { pattern: /boeing|starliner|sls\b/i, symbols: ['BA'], sector: 'defense', category: 'GOVT' },
  { pattern: /redwire|rosa solar/i, symbols: ['RDW'], sector: 'infrastructure', category: 'CONTRACT' },
  { pattern: /intuitive machines|nova-c|lunar lander|\blunr\b/i, symbols: ['LUNR'], sector: 'infrastructure', category: 'LUNAR' },
  { pattern: /momentus|vigoride|orbital transfer/i, symbols: ['MNTS'], sector: 'infrastructure', category: 'TECH' },
  { pattern: /lightpath|space optics/i, symbols: ['LPTH'], sector: 'infrastructure', category: 'TECH' },
  { pattern: /sierra space|dream chaser|life habitat/i, symbols: ['SIERRA'], sector: 'infrastructure', category: 'CONTRACT' },
  { pattern: /axiom space|axiom station/i, symbols: ['AXIOM'], sector: 'infrastructure', category: 'CONTRACT' },
  { pattern: /spire global|lemur constellation|maritime ais/i, symbols: ['SPIR'], sector: 'earth-obs', category: 'TECH' },
  { pattern: /viasat|inmarsat|viasat-3/i, symbols: ['VSAT'], sector: 'satcom', category: 'TELECOM' },
  { pattern: /globalstar|emergency sos/i, symbols: ['GSAT'], sector: 'satcom', category: 'TELECOM' },
  { pattern: /echostar|hughesnet|hughes network/i, symbols: ['SATS'], sector: 'satcom', category: 'TELECOM' },
  { pattern: /\bses\b|o3b|mPOWER/i, symbols: ['SES'], sector: 'satcom', category: 'TELECOM' },
  { pattern: /rtx|raytheon|gps ocx/i, symbols: ['RTX'], sector: 'defense', category: 'GOVT' },
  { pattern: /l3harris|l3 harris/i, symbols: ['LHX'], sector: 'defense', category: 'GOVT' },
  { pattern: /kratos|open space/i, symbols: ['KTOS'], sector: 'defense', category: 'GOVT' },
  { pattern: /general dynamics mission|gd mission systems/i, symbols: ['GD'], sector: 'defense', category: 'GOVT' },
  { pattern: /reliability space|terran r/i, symbols: ['REL'], sector: 'launch', category: 'LAUNCH' },
  { pattern: /firefly aerospace|blue ghost|elytra/i, symbols: ['FIREFLY'], sector: 'launch', category: 'LAUNCH' },
  { pattern: /mp materials|mountain pass|rare earth|neodymium/i, symbols: ['MP'], sector: 'commodities', category: 'TECH' },
  { pattern: /cameco|uranium mine|uranium price/i, symbols: ['CCJ', 'UEC', 'UUUU'], sector: 'commodities', category: 'TECH' },
  { pattern: /hexcel|carbon fiber|composite prepreg/i, symbols: ['HXL'], sector: 'commodities', category: 'TECH' },
  { pattern: /titanium|superalloy|howmet|carpenter technology/i, symbols: ['ATI', 'HWM', 'CRS'], sector: 'commodities', category: 'TECH' },
  { pattern: /freeport|copper mine|copper price/i, symbols: ['FCX'], sector: 'commodities', category: 'TECH' },
  { pattern: /albemarle|lithium|sociedad quimica|\bsqm\b/i, symbols: ['ALB', 'SQM'], sector: 'commodities', category: 'TECH' },
  { pattern: /kaiser aluminum|aluminum-lithium/i, symbols: ['KALU'], sector: 'commodities', category: 'TECH' },
  { pattern: /air products|linde|industrial gas|cryogenic|liquid oxygen/i, symbols: ['APD', 'LIN'], sector: 'commodities', category: 'TECH' },
  { pattern: /critical mineral|propellant|rtg\b|radioisotope/i, symbols: [], sector: 'commodities', category: 'TECH' },
  { pattern: /nvidia|\bh100\b|\bb200\b|blackwell|cuda/i, symbols: ['NVDA'], sector: 'ai', category: 'TECH' },
  { pattern: /\bamd\b|mi300|rocm/i, symbols: ['AMD'], sector: 'ai', category: 'TECH' },
  { pattern: /\bintel\b|gaudi/i, symbols: ['INTC'], sector: 'ai', category: 'TECH' },
  { pattern: /microsoft|azure openai|copilot|github copilot/i, symbols: ['MSFT'], sector: 'ai', category: 'TECH' },
  { pattern: /alphabet|google deepmind|gemini|\btpu\b|vertex ai/i, symbols: ['GOOGL'], sector: 'ai', category: 'TECH' },
  { pattern: /\bmeta\b|\bllama\b|mtia/i, symbols: ['META'], sector: 'ai', category: 'TECH' },
  { pattern: /amazon web services|\baws\b|bedrock|trainium/i, symbols: ['AMZN'], sector: 'ai', category: 'TECH' },
  { pattern: /oracle|\boci\b/i, symbols: ['ORCL'], sector: 'ai', category: 'TECH' },
  { pattern: /salesforce|einstein|agentforce/i, symbols: ['CRM'], sector: 'ai', category: 'TECH' },
  { pattern: /servicenow|now assist/i, symbols: ['NOW'], sector: 'ai', category: 'TECH' },
  { pattern: /snowflake|cortex ai/i, symbols: ['SNOW'], sector: 'ai', category: 'TECH' },
  { pattern: /palantir|\baip\b/i, symbols: ['PLTR'], sector: 'ai', category: 'TECH' },
  { pattern: /c3\.ai|\bc3 ai\b/i, symbols: ['AI'], sector: 'ai', category: 'TECH' },
  { pattern: /uipath|agentic automation/i, symbols: ['PATH'], sector: 'ai', category: 'TECH' },
  { pattern: /soundhound|voice ai/i, symbols: ['SOUN'], sector: 'ai', category: 'TECH' },
  { pattern: /bigbear\.ai|bigbear ai/i, symbols: ['BBAI'], sector: 'ai', category: 'TECH' },
  { pattern: /openai|chatgpt|\bgpt-4/i, symbols: ['OPENAI'], sector: 'ai', category: 'TECH' },
  { pattern: /anthropic|\bclaude\b/i, symbols: ['ANTHR'], sector: 'ai', category: 'TECH' },
  { pattern: /\bxai\b|\bgrok\b|colossus/i, symbols: ['XAI'], sector: 'ai', category: 'TECH' },
  { pattern: /cohere|command a/i, symbols: ['COHERE'], sector: 'ai', category: 'TECH' },
  { pattern: /mistral ai|\ble chat\b/i, symbols: ['MISTRAL'], sector: 'ai', category: 'TECH' },
  { pattern: /scale ai|rlhf/i, symbols: ['SCALE'], sector: 'ai', category: 'TECH' },
  { pattern: /databricks|mosaic ml|\bdbrx\b/i, symbols: ['DBRK'], sector: 'ai', category: 'TECH' },
  { pattern: /artificial intelligence|generative ai|large language model|\bLLM\b|foundation model|agentic ai/i, symbols: [], sector: 'ai', category: 'TECH' },
  { pattern: /nasa|artemis|clps|nssc|space force|ussf/i, symbols: ['LMT', 'BA'], sector: 'defense', category: 'GOVT' },
  { pattern: /\bipo\b|nasdaq debut|public offering|earnings/i, symbols: [], sector: undefined, category: 'EARNINGS' },
  { pattern: /contract|award|wins \$/i, symbols: [], sector: undefined, category: 'CONTRACT' },
  { pattern: /satellite|constellation|orbit/i, symbols: [], sector: 'satcom', category: 'TECH' },
];

const EARNINGS_RE = /earnings|revenue|eps|quarter|guidance|beat|miss/i;
const IPO_RE = /ipo|debut|public offering/i;

export function tagArticle(
  text: string,
  explicitSymbol?: string
): Pick<NewsItem, 'category' | 'relatedSymbols' | 'sectorTab'> {
  const symbols = new Set<string>();
  if (explicitSymbol) symbols.add(explicitSymbol);

  let category = 'NEWS';
  let sectorTab: SectorTab | undefined;

  for (const rule of SYMBOL_RULES) {
    if (rule.pattern.test(text)) {
      rule.symbols.forEach((s) => symbols.add(s));
      category = rule.category;
      sectorTab = rule.sector ?? sectorTab;
    }
  }

  if (IPO_RE.test(text)) category = 'IPO';
  else if (EARNINGS_RE.test(text)) category = 'EARNINGS';

  return {
    category,
    relatedSymbols: Array.from(symbols),
    sectorTab,
  };
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();

  for (const item of items) {
    const key = item.url
      ? item.url.replace(/^https?:\/\//, '').toLowerCase()
      : item.headline.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    if (!existing.imageUrl && item.imageUrl) {
      seen.set(key, { ...existing, imageUrl: item.imageUrl });
    }
  }

  return Array.from(seen.values());
}

export function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
