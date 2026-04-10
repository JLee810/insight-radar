# InsightRadar

AI-powered website tracking and article collection tool. Monitors websites you specify, collects articles, and uses Claude AI to summarize, score relevance, and surface insights.

## Architecture

```
Chrome Extension  →  Express API (port 3001)  →  SQLite DB
                          ↕
                    Claude AI (Anthropic)
                          ↕
              React Dashboard (port 5173)
```

## Prerequisites

- Node.js 22+ (uses built-in `node:sqlite`)
- An [Anthropic API key](https://console.anthropic.com/)

## Quick Start

### 1. Clone and install

```bash
cd insight-radar
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
```

### 3. Install dashboard dependencies

```bash
cd dashboard && npm install && cd ..
```

### 4. Start the server

```bash
npm run server:dev
# Server runs at http://localhost:3001
```

### 5. Start the dashboard

```bash
npm run dashboard:dev
# Dashboard runs at http://localhost:5173
```

Or run both together:

```bash
npm run dev
```

### 6. Load the Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder
5. Click the InsightRadar icon in your toolbar

## Features

### Dashboard (`http://localhost:5173`)
- **Articles feed** — sorted by relevance or date, with AI summaries and color-coded relevance rings
- **Website manager** — add URLs to track with configurable check intervals
- **Interest keywords** — define topics that drive AI relevance scoring
- **AI Insights** — on-demand AI analysis of individual articles
- **Stats overview** — articles today, unread count, avg relevance, top tags

### Chrome Extension
- **One-click save** — save any article to InsightRadar for AI analysis
- **Auto-detection overlay** — subtle prompt on article-like pages
- **Badge counter** — shows unread article count
- **Quick recent feed** — last 5 articles in the popup
- **Settings page** — configure server/dashboard URLs

### Backend
- **Scheduler** — automatically checks tracked websites on their configured interval
- **Scraper** — extracts article titles, content, author, and dates using Cheerio
- **AI Analyzer** — scores relevance 0–100 against your interests, generates summaries, tags, and insights

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/articles` | List articles (filters: `website_id`, `is_read`, `is_bookmarked`, `min_score`, `search`, `sort`, `limit`, `offset`) |
| GET | `/api/articles/:id` | Get single article |
| POST | `/api/articles` | Add article by URL (scrapes + AI-analyzes) |
| PATCH | `/api/articles/:id` | Update read/bookmark status |
| DELETE | `/api/articles/:id` | Delete article |
| GET | `/api/websites` | List tracked websites |
| POST | `/api/websites` | Add website to track |
| PATCH | `/api/websites/:id` | Update website settings |
| DELETE | `/api/websites/:id` | Remove website |
| GET | `/api/interests` | List interest keywords |
| POST | `/api/interests` | Add interest keyword |
| DELETE | `/api/interests/:id` | Remove interest keyword |
| GET | `/api/stats` | Dashboard statistics |
| POST | `/api/analyze` | Re-analyze article with AI |
| GET | `/api/tracking-log` | Website check history |
| GET | `/api/health` | Health check |

## Development

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

## Project Structure

```
insight-radar/
├── chrome-extension/      # Manifest V3 Chrome extension
├── server/
│   ├── db/               # SQLite schema + connection (node:sqlite)
│   ├── routes/           # Express route handlers
│   ├── services/
│   │   ├── scraper.js    # Cheerio-based article extraction
│   │   ├── ai-analyzer.js # Claude API integration
│   │   └── scheduler.js  # node-cron website monitoring
│   └── utils/
├── dashboard/            # React 18 + Vite + Tailwind dashboard
└── CLAUDE.md             # Project rules for Claude Code
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | **Required.** Your Anthropic API key |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment |
