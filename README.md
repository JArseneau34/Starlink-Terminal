# SPCX — Space Sector Terminal

A Bloomberg-style terminal for tracking SpaceX, rocket companies, satellite operators, and the broader space economy.

## Features

- **Bloomberg-inspired UI** — Dense monospace layout, live ticker tape, Space Sector + SPCX Statistics + Commodities tabs, command bar
- **SPCX Statistics tab** — Dedicated SpaceX tracker: live equity, fleet status, operational metrics, milestones, filtered launches & news
- **Commodities tab** — 14 materials suppliers (titanium, rare earth, lithium, uranium, copper, composites, gases) with material index and filtered news
- **Live data backend** — Express API with caching proxies external sources
- **Launch calendar** — Global schedule via Launch Library 2 (364+ upcoming)
- **News wire** — Multi-source: Finnhub company/market news + Spaceflight News API (+ optional Marketaux sentiment)
- **Stock quotes** — **Yahoo batch** (free, all symbols every 4s) + Finnhub WebSocket trades + smart REST for stale symbols

## Quick Start

```bash
npm install
cp .env.example .env   # optional: add FINNHUB_API_KEY
npm run dev
```

This starts both:
- **API server** → `http://localhost:3002`
- **Vite frontend** → `http://localhost:5173`

Open the Vite URL in your browser.

### Orion iframe (Space UI)

Sat Stats is a **separate host**. Orion stores the URL (e.g. `SAT_STATS_BASE_URL`); it does not vendor `constellation/`.

| Env | iframe `src` |
|-----|----------------|
| Prod (`orion.33fg.ai`) | `https://app.sat-stats.33fg.com/?embed=1&tab=ops` |
| UAT (`uat.orion.33fg.ai`) | UAT Sat Stats origin + `/?embed=1&tab=ops` |

`?embed=1` (or `/embed/ops`) drops COOP/COEP so `https://*.33fg.ai` can frame it (`server/embed/orionFrame.ts`). Production `vite build` uses `base: '/'`, not `/mesh/` or `/constellation/`. Push this repo → that URL updates → Orion refresh shows it.

### API keys (recommended)

| Key | Source | Purpose |
|-----|--------|---------|
| `FINNHUB_API_KEY` | [finnhub.io/register](https://finnhub.io/register) | WebSocket trade stream + backup REST (60/min free) |
| `LL2_API_KEY` | [thespacedevs.com/supportus](https://thespacedevs.com/supportus) | Higher launch API rate limits |

**No API key required for quotes** — Yahoo Finance batch polling covers all 37 symbols for free. Finnhub adds sub-second trade updates when configured.

### Quote speed (free tier optimized)

| Layer | Source | Speed | Cost |
|-------|--------|-------|------|
| Primary | Yahoo batch | All symbols every 4s | Free |
| Real-time | Finnhub WebSocket | Trade ticks | Free w/ key |
| Gap-fill | Finnhub REST | Stale symbols only (~45/min budget) | Free w/ key |
| Client | `/api/quotes` poll | 250ms from server memory | Free |

News uses SNAPI (free, unlimited) + Finnhub market news (2 calls) + 12 priority company feeds (not 36).

## Architecture

```
Browser (React)  →  /api/* proxy  →  Express server (port 3002)
                                         ├── Launch Library 2
                                         ├── Spaceflight News API
                                         ├── Yahoo Finance (batch quotes, free)
                                         ├── Finnhub WS + REST (optional)
```

Server caches non-quote data to respect rate limits:
- Quotes: live in-memory stream (15s REST cache fallback)
- Launches: 5 min
- News: 3 min

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/terminal` | Full payload (quotes, launches, news, stats) |
| `GET /api/status` | Data source health |
| `POST /api/refresh` | Clear server cache |
| `GET /api/stream` | WebSocket stream status |
| `WS /ws/quotes` | Real-time quote stream (proxied via Vite in dev) |

## Data Sources

- **Launches**: [Launch Library 2](https://thespacedevs.com/llapi)
- **News**: [Finnhub](https://finnhub.io) (company + market) + [Spaceflight News API](https://thespacedevs.com/snapi) + optional [Marketaux](https://www.marketaux.com)
- **Quotes**: [Finnhub](https://finnhub.io) → Yahoo Finance fallback
- **SPCX (SpaceX)**: Seed data until live ticker available on your provider

## Project Structure

```
server/           # Express API + cache layer
src/
├── components/   # Terminal UI
├── data/         # Company watchlist
├── hooks/        # React state
├── services/     # Client API calls
└── types/
```

## License

MIT
