# Архитектура

> **Одна строка:** self-hosted ASO-инструмент — Vite SPA + Hono API + MCP-сервер в одном Bun-процессе, PostgreSQL через Drizzle, данные сторов из публичных источников (iTunes API, google-play-scraper).

## Слои и поток данных

```
Браузер (React 19 SPA, Vite)              MCP-клиент (Claude Code и др.)
   │ fetch /api/*                                │ /api/mcp (Streamable HTTP)
   ▼                                             ▼
Hono — server/index.ts (один процесс, :3000 в prod)
   ├─ REST: server/routes/**  (монтируются под /api)
   └─ MCP:  server/mcp.ts     (stateful-сессии по Mcp-Session-Id)
                    │
                    ▼
        src/lib/appService.ts — общая логика для REST и MCP
                    │
        ├─► src/lib/** — движки: health.ts, research.ts, reviewAnalysis.ts,
        │             ai.ts/aiLocales.ts, localizationSync.ts, …
        ├─► src/lib/stores/** — App Store (iTunes API + скрейп подзаголовка)
        │                      и Google Play (google-play-scraper)
        └─► Drizzle (@/db, схема src/db/schema.ts) ─► PostgreSQL
```

Ключевой принцип: REST и MCP — два фасада над одной логикой (`appService`), чтобы инструмент и агент не расходились в поведении.

## Процессы и команды

- **dev:** `bun run dev` — Vite на :5173 (проксирует `/api`) + `bun --hot server/index.ts` на :3000.
- **prod:** `bun run build` (typecheck + vite build → `dist/`), затем `bun run start` — один процесс на :3000 отдаёт SPA, API и MCP.
- **БД:** `docker compose up -d db` (локальный Postgres на :5433, либо `DATABASE_URL`). Миграции: `bun run db:generate` / `db:migrate` (drizzle-kit).
- **Трекинг:** `POST /api/track` (защищён `CRON_SECRET`) раз в сутки — `scripts/daily-track.sh` или контейнер `docker/cron/`.

## Клиент/серверская граница

- Серверное (не импортировать из клиентских компонентов — утянет server-only зависимости в браузерный бандл): `src/lib/stores/**`, `src/lib/appService.ts`, `@/db`, `cheerio`, `google-play-scraper`.
- Общие чистые хелперы для клиента и сервера живут отдельными файлами: `src/lib/metricColor.ts`, `src/lib/storeLinks.ts` — отдельно от `research.ts` именно по этой причине.
- UI: React Router (`src/router.tsx`), страницы `src/pages/**`, компоненты `src/components/**`. Данные приходят с API через `fetch('/api/...')`.

## Данные сторов

- **App Store:** публичный iTunes Search/Lookup API; iOS-подзаголовок скрейпится со страницы стора (может молча сломаться при смене вёрстки — `fetchSubtitle` в `src/lib/stores/appstore.ts`).
- **Google Play:** `google-play-scraper`.
- **Volume/difficulty** — эвристики 0–100 по прокси (число результатов, авторитет конкурентов), не реальный объём поиска: бесплатного источника нет.
- Все вызовы сторов идут через `src/lib/withRetry.ts` (ретраи 429/5xx/сетевых ошибок с backoff), чтобы один rate-limit не ронял суточный проход трекинга.

## Схема БД (`src/db/schema.ts`)

`apps`, `appLocalizations`, `keywords`, `keywordRanks`, `keywordCountryRanks`, `competitors`, `competitorRanks`, `healthReports`, `keywordSuggestions`, `reviews`, `aiCopySuggestions`. Ключевая связь: ключевое слово принадлежит сторфронту (стране) — один термин может трекаться в нескольких рынках с отдельной историей рангов.

## Интеграции

- **OpenRouter** (`src/lib/ai.ts`) — генерация AI Copy Suggestions из веб-UI (`OPENROUTER_API_KEY`).
- **MCP key-free путь** — модель сама пишет копу через `prepare_copy_localization_brief` / `save_copy_suggestions`.
- **PostHog — две независимые интеграции, не путать:**
  - собственная аналитика инструмента (`VITE_POSTHOG_KEY`, `src/components/PostHogProvider.tsx`), выключена по умолчанию;
  - product health трекаемого приложения (per-app, `src/components/PostHogSettings.tsx` + `src/lib/posthogIntegration.ts`) — реальные DAU поверх ASO health score.
