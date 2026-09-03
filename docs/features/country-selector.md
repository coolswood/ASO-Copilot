# Глобальный селектор страны (storefront)

> **Одна строка:** страна (сторон storefront) — первое общее состояние приложения, живёт в URL (`/apps/:id?country=de`); все country-зависимые API фильтруются по ней, БД хранит страну у app/competitor/keywordSuggestion.

## Входные точки

- Компонент: `src/components/CountrySelect.tsx` — единственный переиспользуемый пикер storefront (SCAN_COUNTRIES).
- Страницы: `src/pages/AppDetailPage.tsx` (глобальный селектор в шапке через слот `actions` у `AppHeader`), `src/pages/SearchPage.tsx` и `src/pages/NewAppPage.tsx` (локальные query-time пикеры).
- Хелпер: `src/lib/countryParam.ts` — `parseCountryParam` / `resolveCountry` (+ тест `countryParam.test.ts`), общий для клиента и сервера.
- REST: все `?country=` / body-country параметры (таблица ниже).
- MCP: `server/mcp.ts` — country-параметры инструментов.

## Поток данных

```
URL ?country= (AppDetailPage) ─► GET /api/apps/:id?country= ─► фильтрация коллекций
        │                                                              │
        └─ нет/невалидный параметр ─► apps.country (home) ─► "us"     └─ Drizzle: keywords/competitors уже несут country
```

## Решение и цепочка фолбэков

Страна живёт в URL search param (без Context/zustand): `/apps/:id?country=de`. Смена — `setSearchParams(..., { replace: true })`, id сохраняется. Невалидный/отсутствующий параметр резолвится: **URL → `apps.country` (home storefront приложения) → `"us"`**. Пока приложение грузится, используется `"us"` (после загрузки при необходимости перезапрашивается).

## Страна в API

Ровно одна конвенция: чтения — опциональный `?country=` (отсутствие = без фильтра, обратно совместимо); записи — опциональное body-поле `country` (отсутствие = прежний дефолт, обычно `"us"` или `apps.country`). Валидация — `parseCountryParam` (lowercase ISO 3166-1 alpha-2).

| Эндпоинт                                                  | Что делает country                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/apps/:id`                                       | фильтрует keywords и competitors + обрезает ранги конкурентов по ключевым словам этой страны (`filterAppDetailByCountry`) |
| `POST /api/apps`, `POST /api/apps/stream`                 | persist в `apps.country`                                                                                                  |
| `GET/POST /api/apps/:id/keywords`, `POST .../auto-detect` | фильтр / storefront нового ключа                                                                                          |
| `GET/POST /api/apps/:id/competitors`                      | фильтр + ранги по ключевым словам страны / storefront нового конкурента                                                   |
| `GET /api/apps/:id/research`                              | storefront для autocomplete, scoreKeywords, autoDetectCompetitors, persist keywordSuggestions                             |
| `GET/POST /api/apps/:id/reviews`, `GET .../keyword-gaps`  | фильтр анализа отзывов / storefront синка и гэпов                                                                         |
| `POST /api/apps/:id/sync`                                 | storefront метаданных (дефолт — `apps.country`)                                                                           |

MCP: country добавлен в `get_app`, `sync_app`, `list_keywords`, `add_competitor`, `find_winning_keywords`, `sync_reviews`, `get_review_analysis`, `find_review_keyword_gaps` (нормализация `normalizeCountry`); `track_now` работает per-app по `apps.country`.

## Хранение

`src/db/schema.ts`: `apps.country` (home storefront), `competitors.country` (уникальный ключ стал `appId+platform+storeId+country`), `keywordSuggestions.country` (уникальный ключ `appId+term+country`). Существовавшие строки мигрированы дефолтом `'us'`. `keywords.country` был и остаётся. `reviews.country` пишется при синке.

## Инварианты и подводные камни

- **Health score — глобальный**: `healthReports` без страны, `recomputeHealth` не трогаем.
- **Locale ≠ country**: локализации (`appLocalizations`, `aiCopySuggestions`, AI-copy инструменты) живут на своей оси locale — не смешивать.
- **Ранги ключей всегда в стране ключа**: `trackKeyword`/`runDailyTracking` используют `keyword.country`; `runDailyTracking()` берёт `app.country` для метаданных/отзывов.
- **Global Reach не фильтруется**: AppDetailPage грузит отдельный полный список keyword-refs для `GlobalReachSection` — сканер по определению кросс-страновой.
- Клиентские секции (`KeywordsSection` и др.) получают страну пропсом из AppDetailPage — локальных пикеров страны в них больше нет.

## Связи

- Родственные фичи: трекинг ключевых слов (таблица в [../INDEX.md](../INDEX.md)), Global Reach, отзывы.
- Общая карта: [../ARCHITECTURE.md](../ARCHITECTURE.md).

---

_Обновляй этот файл при любой правке фичи (правило AGENTS.md №8). Держи тощим: ссылайся на код, не дублируй его._
