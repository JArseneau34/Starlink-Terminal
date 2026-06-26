import type { Company, NewsItem } from '../types';

export type AiCategory =
  | 'chips'
  | 'hyperscaler'
  | 'foundation-model'
  | 'enterprise'
  | 'applied';

export interface AiCompany extends Company {
  aiCategory: AiCategory;
  aiFocus: string;
}

export interface AiStackRow {
  layer: string;
  category: AiCategory;
  leaders: string;
  spaceRelevance: string;
  momentum: 'ACCELERATING' | 'STABLE' | 'EMERGING';
}

export const AI_COMPANIES: AiCompany[] = [
  {
    id: 'nvda',
    symbol: 'NVDA',
    name: 'NVIDIA',
    type: 'public',
    sector: 'AI Chips & Infrastructure',
    sectorTab: 'ai',
    aiCategory: 'chips',
    aiFocus: 'GPU accelerators, CUDA ecosystem, Blackwell training/inference platforms',
    description:
      'Dominant AI compute supplier. H100/H200/B200 GPUs power frontier model training and hyperscaler inference fleets. NVLink, Spectrum-X, and DGX systems anchor the AI data center stack.',
    headquarters: 'Santa Clara, CA',
    founded: 1993,
    employees: '36,000+',
    keyMetrics: {
      'Data Center Rev': 'Record',
      Blackwell: 'Shipping',
      CUDA: 'Ecosystem moat',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'amd',
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    type: 'public',
    sector: 'AI Chips & Infrastructure',
    sectorTab: 'ai',
    aiCategory: 'chips',
    aiFocus: 'MI300X/MI350 accelerators, EPYC CPUs for AI clusters, ROCm software stack',
    description:
      'Second-source GPU and CPU supplier for AI workloads. MI300 series targets LLM training and inference; EPYC CPUs pair with accelerators in large training pods.',
    headquarters: 'Santa Clara, CA',
    founded: 1969,
    employees: '28,000+',
    keyMetrics: {
      'MI300': 'Ramping',
      ROCm: 'Expanding',
      'EPYC Share': 'Growing',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'intc',
    symbol: 'INTC',
    name: 'Intel',
    type: 'public',
    sector: 'AI Chips & Infrastructure',
    sectorTab: 'ai',
    aiCategory: 'chips',
    aiFocus: 'Gaudi accelerators, Xeon CPUs, foundry services for AI ASICs',
    description:
      'Rebuilding AI accelerator portfolio with Gaudi 3. Xeon remains the host CPU in most inference racks; Intel Foundry targets custom AI silicon for cloud and edge.',
    headquarters: 'Santa Clara, CA',
    founded: 1968,
    employees: '125,000',
    keyMetrics: {
      Gaudi: 'Gen 3',
      Foundry: '18A roadmap',
      Xeon: 'Inference host',
      'AI Exposure': 'MODERATE',
    },
  },
  {
    id: 'msft',
    symbol: 'MSFT',
    name: 'Microsoft',
    type: 'public',
    sector: 'Hyperscaler & Cloud AI',
    sectorTab: 'ai',
    aiCategory: 'hyperscaler',
    aiFocus: 'Azure OpenAI, Copilot suite, Phi small models, Maia AI accelerators',
    description:
      'Largest enterprise AI distribution layer via Microsoft 365 Copilot and Azure. Strategic OpenAI partnership; building custom Maia chips and growing Azure AI revenue share.',
    headquarters: 'Redmond, WA',
    founded: 1975,
    employees: '228,000',
    keyMetrics: {
      Copilot: 'Enterprise scale',
      'Azure AI': 'Fastest growth',
      OpenAI: 'Strategic partner',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'googl',
    symbol: 'GOOGL',
    name: 'Alphabet',
    type: 'public',
    sector: 'Hyperscaler & Cloud AI',
    sectorTab: 'ai',
    aiCategory: 'hyperscaler',
    aiFocus: 'Gemini models, Google Cloud Vertex AI, TPU v5/v6, DeepMind research',
    description:
      'Full-stack AI from TPU silicon through Gemini foundation models to Search and Cloud distribution. DeepMind leads frontier research; Vertex AI targets enterprise workloads.',
    headquarters: 'Mountain View, CA',
    founded: 1998,
    employees: '183,000',
    keyMetrics: {
      Gemini: 'Multimodal',
      TPU: 'v6 ramp',
      'Cloud AI': 'Growing',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'meta',
    symbol: 'META',
    name: 'Meta Platforms',
    type: 'public',
    sector: 'Hyperscaler & Cloud AI',
    sectorTab: 'ai',
    aiCategory: 'hyperscaler',
    aiFocus: 'Llama open-weight models, MTIA accelerators, AI recommendation stack',
    description:
      'Open-sourcing Llama family reshaped the model ecosystem. Massive capex on AI infrastructure for ads, feed ranking, and metaverse compute. MTIA custom chips reduce NVIDIA dependency.',
    headquarters: 'Menlo Park, CA',
    founded: 2004,
    employees: '74,000',
    keyMetrics: {
      Llama: 'Open weights',
      MTIA: 'Custom ASIC',
      'AI Capex': '$40B+ guide',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'amzn',
    symbol: 'AMZN',
    name: 'Amazon',
    type: 'public',
    sector: 'Hyperscaler & Cloud AI',
    sectorTab: 'ai',
    aiCategory: 'hyperscaler',
    aiFocus: 'AWS Bedrock, Trainium/Inferentia chips, Alexa+, Amazon Q',
    description:
      'AWS Bedrock offers multi-model API access. Custom Trainium2 and Inferentia2 chips target cost-efficient training and inference at hyperscale.',
    headquarters: 'Seattle, WA',
    founded: 1994,
    employees: '1,500,000+',
    keyMetrics: {
      Bedrock: 'Multi-model',
      Trainium: 'Gen 2',
      'Amazon Q': 'Enterprise agent',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'orcl',
    symbol: 'ORCL',
    name: 'Oracle',
    type: 'public',
    sector: 'Enterprise AI',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'OCI GPU superclusters, database AI vector search, enterprise agents',
    description:
      'Rapidly scaling OCI GPU capacity for AI training contracts. Autonomous Database and vector search integrate AI into enterprise data estates.',
    headquarters: 'Austin, TX',
    founded: 1977,
    employees: '159,000',
    keyMetrics: {
      'OCI GPUs': 'Expanding',
      'RPO Growth': 'Record',
      'Vector DB': 'Native',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'crm',
    symbol: 'CRM',
    name: 'Salesforce',
    type: 'public',
    sector: 'Enterprise AI',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'Einstein GPT, Agentforce autonomous agents, Data Cloud',
    description:
      'Embedding generative AI across Sales, Service, and Marketing Cloud. Agentforce targets autonomous enterprise workflows on proprietary customer data.',
    headquarters: 'San Francisco, CA',
    founded: 1999,
    employees: '72,000',
    keyMetrics: {
      Agentforce: 'GA',
      Einstein: 'Embedded',
      'Data Cloud': 'AI-ready',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'now',
    symbol: 'NOW',
    name: 'ServiceNow',
    type: 'public',
    sector: 'Enterprise AI',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'Now Assist, workflow AI agents, enterprise service automation',
    description:
      'AI agents embedded in IT, HR, and customer service workflows. Now Platform positions ServiceNow as the orchestration layer for enterprise AI automation.',
    headquarters: 'Santa Clara, CA',
    founded: 2004,
    employees: '26,000+',
    keyMetrics: {
      'Now Assist': 'Deployed',
      'Pro Plus': 'AI tier',
      'Workflow AI': 'Core',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'snow',
    symbol: 'SNOW',
    name: 'Snowflake',
    type: 'public',
    sector: 'Enterprise AI',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'Cortex AI, Snowpark ML, data lakehouse for model training pipelines',
    description:
      'Data cloud platform for AI feature stores and RAG pipelines. Cortex brings LLM functions directly into SQL workflows for governed enterprise AI.',
    headquarters: 'Bozeman, MT',
    founded: 2012,
    employees: '7,000+',
    keyMetrics: {
      Cortex: 'LLM in SQL',
      Snowpark: 'ML runtime',
      'Data Cloud': 'AI pipelines',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'pltr',
    symbol: 'PLTR',
    name: 'Palantir',
    type: 'public',
    sector: 'Applied AI & Defense',
    sectorTab: 'ai',
    aiCategory: 'applied',
    aiFocus: 'AIP (Artificial Intelligence Platform), Gotham, Foundry, government LLM ops',
    description:
      'Operationalizes AI for defense, intelligence, and industrial customers. AIP deploys LLMs on classified and enterprise data with human-in-the-loop governance.',
    headquarters: 'Denver, CO',
    founded: 2003,
    employees: '4,000+',
    keyMetrics: {
      AIP: 'Fast adoption',
      'US Govt': 'Core customer',
      Foundry: 'Commercial',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'ai',
    symbol: 'AI',
    name: 'C3.ai',
    type: 'public',
    sector: 'Applied AI & Enterprise',
    sectorTab: 'ai',
    aiCategory: 'applied',
    aiFocus: 'Enterprise AI applications, predictive maintenance, generative AI suites',
    description:
      'Pure-play enterprise AI software. Model-driven architecture for industrial, defense, and financial services AI applications at scale.',
    headquarters: 'Redwood City, CA',
    founded: 2009,
    employees: '1,000+',
    keyMetrics: {
      'C3 Generative': 'GA',
      'DoD Contracts': 'Active',
      'Partner Network': 'Big 4 + cloud',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'path',
    symbol: 'PATH',
    name: 'UiPath',
    type: 'public',
    sector: 'Applied AI & Automation',
    sectorTab: 'ai',
    aiCategory: 'applied',
    aiFocus: 'Agentic automation, document understanding, RPA + LLM orchestration',
    description:
      'Combines robotic process automation with generative AI for agentic workflows. Document AI and communications mining target back-office automation.',
    headquarters: 'New York, NY',
    founded: 2005,
    employees: '4,000+',
    keyMetrics: {
      'Agentic AI': 'Platform pivot',
      Autopilot: 'Copilot layer',
      'ARR Growth': 'Stabilizing',
      'AI Exposure': 'HIGH',
    },
  },
  {
    id: 'soun',
    symbol: 'SOUN',
    name: 'SoundHound AI',
    type: 'public',
    sector: 'Applied AI & Voice',
    sectorTab: 'ai',
    aiCategory: 'applied',
    aiFocus: 'Voice AI, conversational agents, automotive and restaurant deployments',
    description:
      'Voice-first AI platform for automotive, IoT, and customer service. Polaris model family powers on-device and cloud voice interactions.',
    headquarters: 'Santa Clara, CA',
    founded: 2005,
    employees: '700+',
    keyMetrics: {
      Polaris: 'Voice LLM',
      Automotive: 'OEM wins',
      'Restaurant AI': 'Scaling',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'bbai',
    symbol: 'BBAI',
    name: 'BigBear.ai',
    type: 'public',
    sector: 'Applied AI & Defense',
    sectorTab: 'ai',
    aiCategory: 'applied',
    aiFocus: 'Decision intelligence, computer vision, predictive analytics for defense',
    description:
      'AI-powered analytics for national security, supply chain, and manufacturing. Combines computer vision and predictive models for mission-critical decisions.',
    headquarters: 'McLean, VA',
    founded: 2020,
    employees: '400+',
    keyMetrics: {
      'DoD Programs': 'Active',
      'Computer Vision': 'Core',
      'Supply Chain AI': 'Growing',
      'AI Exposure': 'CORE',
    },
  },
  {
    id: 'openai',
    symbol: 'OPENAI',
    name: 'OpenAI',
    type: 'private',
    sector: 'Foundation Models',
    sectorTab: 'ai',
    aiCategory: 'foundation-model',
    aiFocus: 'GPT-4o/o-series reasoning models, ChatGPT, API platform, Sora video',
    description:
      'Frontier lab behind ChatGPT and the GPT model family. Microsoft strategic investor; API powers a large share of third-party AI applications globally.',
    headquarters: 'San Francisco, CA',
    founded: 2015,
    valuation: '$300B',
    employees: '3,500+',
    keyMetrics: {
      ChatGPT: '800M+ WAU',
      'GPT-4o': 'Flagship',
      o3: 'Reasoning',
      'Revenue Run Rate': '$13B+',
    },
  },
  {
    id: 'anthropic',
    symbol: 'ANTHR',
    name: 'Anthropic',
    type: 'private',
    sector: 'Foundation Models',
    sectorTab: 'ai',
    aiCategory: 'foundation-model',
    aiFocus: 'Claude model family, constitutional AI, enterprise API, computer use agents',
    description:
      'Safety-focused frontier lab. Claude powers enterprise coding and research workflows; Amazon and Google are strategic investors with cloud distribution deals.',
    headquarters: 'San Francisco, CA',
    founded: 2021,
    valuation: '$61.5B',
    employees: '1,500+',
    keyMetrics: {
      Claude: 'Opus 4',
      'Constitutional AI': 'Differentiator',
      'Enterprise API': 'Scaling',
      'Revenue Run Rate': '$4B+',
    },
  },
  {
    id: 'xai',
    symbol: 'XAI',
    name: 'xAI',
    type: 'private',
    sector: 'Foundation Models',
    sectorTab: 'ai',
    aiCategory: 'foundation-model',
    aiFocus: 'Grok models, Colossus training cluster, X platform integration',
    description:
      'Musk-founded AI lab building Grok with one of the largest GPU training clusters (Colossus). Tightly integrated with X for real-time data and distribution.',
    headquarters: 'Palo Alto, CA',
    founded: 2023,
    valuation: '$80B',
    employees: '500+',
    keyMetrics: {
      Grok: '3.x series',
      Colossus: '200K+ GPUs',
      'X Integration': 'Native',
      'Funding Round': '$10B (2026)',
    },
  },
  {
    id: 'cohere',
    symbol: 'COHERE',
    name: 'Cohere',
    type: 'private',
    sector: 'Foundation Models',
    sectorTab: 'ai',
    aiCategory: 'foundation-model',
    aiFocus: 'Command/Rerank models, enterprise RAG, sovereign AI deployments',
    description:
      'Enterprise-focused model provider emphasizing data privacy and on-prem deployment. Command A targets retrieval-augmented generation at production scale.',
    headquarters: 'Toronto, ON',
    founded: 2019,
    valuation: '$6.8B',
    employees: '400+',
    keyMetrics: {
      'Command A': 'Enterprise LLM',
      Rerank: 'Industry standard',
      'Sovereign AI': 'Gov focus',
      'NVIDIA Backing': 'Strategic',
    },
  },
  {
    id: 'mistral',
    symbol: 'MISTRAL',
    name: 'Mistral AI',
    type: 'private',
    sector: 'Foundation Models',
    sectorTab: 'ai',
    aiCategory: 'foundation-model',
    aiFocus: 'Open and proprietary frontier models, European sovereign AI, Le Chat',
    description:
      'Paris-based frontier lab producing efficient open-weight and commercial models. Positioned as Europe\'s leading independent AI foundation model company.',
    headquarters: 'Paris, France',
    founded: 2023,
    valuation: '$6.4B',
    employees: '200+',
    keyMetrics: {
      'Mistral Large': 'Frontier',
      'Open Models': 'Apache 2.0',
      'Le Chat': 'Consumer',
      'EU Sovereign': 'Strategic',
    },
  },
  {
    id: 'scale',
    symbol: 'SCALE',
    name: 'Scale AI',
    type: 'private',
    sector: 'AI Infrastructure & Data',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'Training data labeling, RLHF, government AI evaluation, Donovan platform',
    description:
      'Data infrastructure layer for frontier model training. Labels, evaluates, and curates datasets for defense and commercial AI programs including LLM red-teaming.',
    headquarters: 'San Francisco, CA',
    founded: 2016,
    valuation: '$29B',
    employees: '900+',
    keyMetrics: {
      'DoD Contracts': 'Major',
      RLHF: 'Industry leader',
      Donovan: 'Gov AI platform',
      'Meta Investment': '49% stake',
    },
  },
  {
    id: 'databricks',
    symbol: 'DBRK',
    name: 'Databricks',
    type: 'private',
    sector: 'Enterprise AI & Data',
    sectorTab: 'ai',
    aiCategory: 'enterprise',
    aiFocus: 'DBRX models, Mosaic ML, Unity Catalog, lakehouse AI pipelines',
    description:
      'Unified data and AI platform for enterprise model training and deployment. Acquired Mosaic ML; DBRX open models compete in the efficient LLM tier.',
    headquarters: 'San Francisco, CA',
    founded: 2013,
    valuation: '$100B',
    employees: '8,000+',
    keyMetrics: {
      'ARR Run Rate': '$4B+',
      DBRX: 'Open model',
      'Mosaic ML': 'Acquired',
      'Lakehouse AI': 'Core',
    },
  },
];

export const AI_STACK_INDEX: AiStackRow[] = [
  {
    layer: 'Training & Inference Silicon',
    category: 'chips',
    leaders: 'NVDA, AMD, INTC, GOOGL TPU, AMZN Trainium',
    spaceRelevance: 'Onboard satellite inference, autonomous GNC compute',
    momentum: 'ACCELERATING',
  },
  {
    layer: 'Cloud AI Platforms',
    category: 'hyperscaler',
    leaders: 'MSFT Azure, GOOGL GCP, AMZN AWS, ORCL OCI',
    spaceRelevance: 'Ground segment ops, mission planning, digital twins',
    momentum: 'ACCELERATING',
  },
  {
    layer: 'Foundation Models',
    category: 'foundation-model',
    leaders: 'OpenAI, Anthropic, Google, Meta Llama, xAI',
    spaceRelevance: 'Autonomous ops copilots, anomaly detection, mission analysis',
    momentum: 'ACCELERATING',
  },
  {
    layer: 'Enterprise AI Software',
    category: 'enterprise',
    leaders: 'CRM, NOW, SNOW, ORCL, Databricks',
    spaceRelevance: 'Program management, supply chain, classified data governance',
    momentum: 'STABLE',
  },
  {
    layer: 'Applied & Defense AI',
    category: 'applied',
    leaders: 'PLTR, C3.ai, Scale AI, BBAI',
    spaceRelevance: 'SSA conjunction analysis, launch ops, ISR fusion',
    momentum: 'EMERGING',
  },
];

const AI_SYMBOLS = AI_COMPANIES.map((c) => c.symbol);

const AI_NEWS_PATTERN =
  /artificial intelligence|\bAI\b|large language model|\bLLM\b|generative AI|\bGPT\b|chatgpt|claude|gemini|copilot|machine learning|\bGPU\b|nvidia|openai|anthropic|deepmind|foundation model|neural network|transformer model|inference|training cluster|agentic/i;

const SYMBOL_NEWS_MAP: Record<string, RegExp> = {
  NVDA: /nvidia|\bh100\b|\bb200\b|blackwell|cuda/i,
  AMD: /\bamd\b|mi300|rocm|epyc/i,
  INTC: /\bintel\b|gaudi|xeon/i,
  MSFT: /microsoft|azure openai|copilot|github copilot/i,
  GOOGL: /alphabet|google deepmind|gemini|\btpu\b|vertex ai/i,
  META: /\bmeta\b|\bllama\b|mtia/i,
  AMZN: /amazon web services|\baws\b|bedrock|trainium|inferentia/i,
  ORCL: /oracle|\boci\b/i,
  CRM: /salesforce|einstein|agentforce/i,
  NOW: /servicenow|now assist/i,
  SNOW: /snowflake|cortex ai/i,
  PLTR: /palantir|\baip\b/i,
  AI: /c3\.ai|\bc3 ai\b/i,
  PATH: /uipath|agentic automation/i,
  SOUN: /soundhound|voice ai/i,
  BBAI: /bigbear\.ai|bigbear ai/i,
  OPENAI: /openai|chatgpt|\bgpt-4/i,
  ANTHR: /anthropic|\bclaude\b/i,
  XAI: /\bxai\b|\bgrok\b|colossus/i,
  COHERE: /cohere|command a/i,
  MISTRAL: /mistral ai|\ble chat\b/i,
  SCALE: /scale ai|rlhf/i,
  DBRK: /databricks|mosaic ml|\bdbrx\b/i,
};

export function getAiCategoryLabel(category: AiCategory): string {
  const labels: Record<AiCategory, string> = {
    chips: 'Chips & Infra',
    hyperscaler: 'Hyperscaler',
    'foundation-model': 'Foundation Models',
    enterprise: 'Enterprise AI',
    applied: 'Applied AI',
  };
  return labels[category];
}

export function getAiBySymbol(symbol: string): AiCompany | undefined {
  return AI_COMPANIES.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase());
}

export function filterAiCompanies(showPrivate = true): AiCompany[] {
  return AI_COMPANIES.filter((c) => showPrivate || c.type === 'public');
}

export function isAiNews(item: NewsItem): boolean {
  if (item.sectorTab === 'ai') return true;
  if (item.relatedSymbols.some((s) => AI_SYMBOLS.includes(s))) return true;
  const text = `${item.headline} ${item.summary ?? ''}`;
  if (AI_NEWS_PATTERN.test(text)) return true;
  return AI_COMPANIES.some((c) => SYMBOL_NEWS_MAP[c.symbol]?.test(text));
}

export function filterAiNews(news: NewsItem[]): NewsItem[] {
  return news.filter(isAiNews);
}

export function tagAiSymbols(text: string): string[] {
  const symbols = new Set<string>();
  for (const company of AI_COMPANIES) {
    const pattern = SYMBOL_NEWS_MAP[company.symbol];
    if (pattern?.test(text)) symbols.add(company.symbol);
  }
  if (AI_NEWS_PATTERN.test(text)) {
    for (const company of AI_COMPANIES) {
      if (new RegExp(company.name.split(' ')[0], 'i').test(text)) {
        symbols.add(company.symbol);
      }
    }
  }
  return Array.from(symbols);
}
