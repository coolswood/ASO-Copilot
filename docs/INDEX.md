# База знаний проекта

Карта фич и их связей. Каждая фича — отдельный файл в `docs/features/`, связанные ссылками образуют граф. Цель: понять фичу за чтение **одного** короткого файла вместо десятка исходников.

## Как пользоваться (агенту)

1. Начинаешь работу над фичей → открой её док из списка ниже.
2. Док ведёт к нужным файлам по ссылкам; открывай только тот, что правишь.
3. Нет дока для фичи → создай по шаблону `docs/features/_TEMPLATE.md` (правило AGENTS.md №8).
4. Порядок навигации: фича-док → этот индекс → `Grep`/`Glob` по точным сигнатурам → `Read` нужного файла.
5. Закончил правку → **обнови** соответствующий док.

## Фичи

Пока доки не созданы — в столбце «Ключевые файлы» стартовые точки; при создании дока заменяй «—» ссылкой.

| Фича                                  | Док | Ключевые файлы                                                                                                                      |
| ------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Дашборд и управление приложениями     | —   | `src/pages/DashboardPage.tsx`, `server/routes/apps.ts`, `server/routes/apps.sync.ts`                                                |
| Карточка приложения (табы, секции)    | —   | `src/pages/AppDetailPage.tsx`, `src/components/AppTabs.tsx`                                                                         |
| Трекинг ключевых слов (по сторфронту) | —   | `server/routes/track.ts`, `server/routes/apps.keywords.ts`                                                                          |
| Health score                          | —   | `src/lib/health.ts`, `server/routes/apps.health.ts`, `src/components/HealthReportPanel.tsx`                                         |
| Keyword research (winning keywords)   | —   | `src/lib/research.ts`, `server/routes/keyword-ideas.ts`, `src/components/ResearchSection.tsx`                                       |
| Global Reach (карта по странам)       | —   | `src/components/GlobalReachSection.tsx`, `src/components/WorldMap.tsx`, `keywordCountryRanks` в схеме                               |
| Отзывы и их анализ                    | —   | `server/routes/apps.reviews.ts`, `src/lib/reviewAnalysis.ts`, `src/components/ReviewsSection.tsx`                                   |
| Локализации и их аудит                | —   | `server/routes/apps.localizations.ts`, `src/lib/localizationSync.ts`, `src/lib/localizationAudit.ts`, `src/lib/localeCandidates.ts` |
| AI Copy Suggestions                   | —   | `src/lib/ai.ts`, `src/lib/aiLocales.ts`, `server/routes/apps.ai-suggestions.ts`, `src/components/AICopySuggestions.tsx`             |
| Конкуренты                            | —   | `server/routes/apps.competitors.ts`, `src/components/CompetitorsSection.tsx`                                                        |
| Product health (PostHog overlay)      | —   | `src/lib/posthogIntegration.ts`, `server/routes/apps.posthog.ts`, `src/components/ProductHealthChart.tsx`                           |
| Поиск по сторам                       | —   | `server/routes/search.ts`, `src/pages/SearchPage.tsx`, `src/pages/NewAppPage.tsx`                                                   |
| MCP-сервер                            | —   | `server/mcp.ts`                                                                                                                     |
| Общая логика REST + MCP               | —   | `src/lib/appService.ts`                                                                                                             |

<!-- Добавляй новые строки сюда по мере создания фич. -->

## Модули

Сложные переиспользуемые компоненты (триггеры и каноническая структура — правило AGENTS.md №10). Док модуля — `README.md` в его папке.

| Модуль | README | Локация | Назначение                                                |
| ------ | ------ | ------- | --------------------------------------------------------- |
| —      | —      | —       | пока нет; оформляй по правилу №10 при достижении триггера |

<!-- Добавляй новые строки сюда по мере создания модулей. -->

## Справочные документы

- [ARCHITECTURE.md](./ARCHITECTURE.md) — карта слоёв, поток данных, интеграции.
- [TESTING.md](./TESTING.md) — правила тестирования (`bun test`, co-located `*.test.ts`).
- [features/_TEMPLATE.md](./features/_TEMPLATE.md) — шаблон нового фича-дока.

## Правила поддержания

- **Один док на фичу**, тощий (~50–80 строк): ссылки на код, а не копия кода.
- **Синхронность**: док обновляется вместе с кодом. Протухший док хуже отсутствующего — если сомневаешься, что актуально, отметь `<!-- TODO: проверить -->`.
- **Связи**: каждая фича ссылается на родственные (`./<name>.md`) и на общие доки.
