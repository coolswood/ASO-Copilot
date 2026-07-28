# ASO Copilot

A self-hosted, free alternative to tools like rankd.dev/AppTweak/ASOMobile for developers managing
their own apps. Single-user, no accounts, no billing — just your apps.

Also exposes an MCP server so an agent (Claude Code, Claude Desktop, etc.) can manage your ASO
directly: add apps, track keywords, pull health reports, spy on competitors, and find keyword
opportunities.

## Features

- **Daily keyword rank tracking** — real ranks from live App Store / Google Play search results
- **Unlimited apps, keywords, competitors** — it's your database, no plan limits
- **Competitor spy** — track competitor apps and see their rank for every keyword you track
- **Health score analysis** — title/subtitle/screenshots/description/ratings/freshness breakdown
  with suggestions, same shape as the paid tools
- **Keyword research** — "find winning keywords" derives candidates from your + competitors'
  metadata and scores them by estimated demand/difficulty using live store search data
- **MCP server** at `/api/mcp` for agent-driven ASO management

## Stack

Next.js (App Router) + Prisma + PostgreSQL. Store data comes from the public iTunes Search/Lookup
API (App Store) and `google-play-scraper` (Google Play). There is no free official API for search
volume or keyword rank position, so:

- **Rank position** is real: it's your app's actual index in a live search for that term.
- **Volume/difficulty** are heuristics (0-100) derived from result-count and competitor-authority
  proxies, not real search volume — there's no free source for that.
- iOS **subtitle** is scraped from the public App Store product page (not exposed by the iTunes
  API). If Apple changes their page markup this can silently start returning `null` — see
  `fetchSubtitle` in `src/lib/stores/appstore.ts`.

## Setup

```bash
npm install
docker compose up -d          # local Postgres on port 5433
npx prisma migrate dev        # create tables
npm run dev
```

Open http://localhost:3000, click **Add App**, search for your app, and add it.

Copy `.env.example` to `.env` and adjust `DATABASE_URL` if you're pointing at a different Postgres
instance (e.g. Supabase/Neon/RDS instead of the bundled docker-compose one).

## Daily tracking

Rank checks don't run automatically — trigger `POST /api/track` (protected by `CRON_SECRET` from
your `.env`) once a day:

```bash
curl -X POST http://localhost:3000/api/track -H "Authorization: Bearer $CRON_SECRET"
```

`scripts/daily-track.sh` wraps this for cron:

```cron
0 6 * * * APP_URL=http://localhost:3000 CRON_SECRET=... /path/to/scripts/daily-track.sh >> /var/log/aso-track.log 2>&1
```

Any external scheduler works the same way (GitHub Actions `schedule:` trigger, a hosting
provider's cron jobs, etc.) — it just needs to hit that one endpoint once a day.

### Or run the bundled cron container

`docker compose up -d cron` starts a small Alpine container (`docker/cron/`) that runs
`scripts/daily-track.sh` on a schedule via `crond`, hitting the app over `host.docker.internal`
since the app itself runs on the host, not in Docker. Configure it via `.env`:

```bash
CRON_SECRET="..."                        # required, shared with the app's own .env
APP_URL="http://host.docker.internal:3000"  # optional, this is the default
CRON_SCHEDULE="0 6 * * *"                # optional, standard 5-field cron syntax
```

## Connecting an agent (MCP)

The app exposes an MCP server at `/api/mcp` (Streamable HTTP transport) with tools for listing
apps, searching stores, adding apps/keywords/competitors, pulling health reports, finding winning
keywords, and running a tracking pass on demand.

Point any MCP-compatible client at it, e.g. in Claude Code (`.mcp.json`):

```json
{
  "mcpServers": {
    "aso-copilot": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

There's no auth on this endpoint by default — it has full read/write access to your ASO data, so
don't expose it on the public internet without adding your own auth in front of it.

## Analytics (optional)

Usage analytics are off by default. Set `NEXT_PUBLIC_POSTHOG_KEY` (and optionally
`NEXT_PUBLIC_POSTHOG_HOST` if self-hosting PostHog) in `.env` to enable pageview tracking via
`src/components/PostHogProvider.tsx` — no code changes needed, it's a no-op until the key is set.

## Project layout

- `src/lib/stores/` — App Store (iTunes) and Google Play data fetching
- `src/lib/health.ts` — health score engine
- `src/lib/research.ts` — keyword candidate generation + volume/difficulty scoring
- `src/lib/appService.ts` — shared logic used by both the REST API and the MCP tools
- `src/app/api/` — REST routes
- `src/app/api/[transport]/route.ts` — MCP server
