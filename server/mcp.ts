import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "@/db";
import {
  appLocalizations,
  apps,
  competitorRanks,
  competitors,
  healthReports,
  keywordRanks,
  keywords,
} from "@/db/schema";
import * as stores from "@/lib/stores";
import {
  addCompetitor,
  addKeyword,
  autoDetectCompetitors,
  autoDetectKeywords,
  createApp,
  findReviewKeywordGaps,
  getProductHealthTrend,
  getReviewAnalysis,
  recomputeHealth,
  runDailyTracking,
  runGlobalScan,
  syncAppMetadata,
  syncReviews,
} from "@/lib/appService";
import {
  extractSeedTerms,
  expandCandidates,
  scoreKeywords,
  scoreKeywordIdea,
  keywordOpportunityRank,
  discoverKeywordIdeas,
  discoverLocaleKeywords,
} from "@/lib/research";
import {
  AIConfigError,
  buildCopyLocalizationBrief,
  generateCopySuggestions,
  saveCopySuggestions,
  type CopyLocalizationBrief,
  type CopySuggestion,
} from "@/lib/ai";
import { AI_LOCALES, type AILocale } from "@/lib/aiLocales";
import { DESCRIPTION_IDEAL_LEN, SUBTITLE_RANGE, TITLE_MAX } from "@/lib/health";
import type { StorePlatform } from "@/lib/stores/types";

// Ported from the original Next.js route handler (which used a Next-only MCP
// adapter) to a plain Hono sub-app backed directly by
// @modelcontextprotocol/sdk's Streamable HTTP transport. The tool surface is
// a public contract (documented in README) — names, descriptions, input
// schemas, output shapes and error behavior are ported 1:1. The only
// intentional changes: prisma -> drizzle for the direct DB reads (same
// columns/relations, so serialized shapes are unchanged; like the REST
// routes, the secret posthogApiKey column is never selected), and real
// stateful sessions (the old adapter's streamable path was effectively
// stateless: a fresh transport+server per POST, and 405 for GET/DELETE).

const platformSchema = z.enum(["IOS", "ANDROID"]);

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(e: unknown) {
  return {
    content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
    isError: true as const,
  };
}

interface BriefableApp {
  id: string;
  platform: StorePlatform;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  keywords: { term: string }[];
}

/** Real local-market search phrases for one locale (see
 * discoverLocaleKeywords) - shared by both AI-copy tools below so they hand
 * the model (whoever ends up composing the copy, OpenRouter or the calling
 * MCP client itself) the same local-demand signal either way. */
async function discoverKeywordsForLocale(app: BriefableApp, locale: AILocale): Promise<string[]> {
  const isBaseEnglish = locale.code === "en" || locale.code.startsWith("en-");
  if (isBaseEnglish) return [];
  const localization = await db.query.appLocalizations.findFirst({
    where: and(eq(appLocalizations.appId, app.id), eq(appLocalizations.locale, locale.code)),
  });
  const seedText = [localization?.title ?? app.title, localization?.subtitle ?? app.subtitle]
    .filter(Boolean)
    .join(" ");
  return discoverLocaleKeywords(app.platform, seedText, locale.country, locale.code).catch(() => []);
}

/** Builds one locale's copy-localization brief - used directly by
 * prepare_copy_localization_brief, and by get_ai_copy_suggestions' no-key
 * fallback below, so both tools hand the calling model the exact same input
 * regardless of which one they called. */
async function buildLocaleBrief(
  app: BriefableApp,
  locale: AILocale,
  discoveredKeywords?: string[],
): Promise<CopyLocalizationBrief> {
  return buildCopyLocalizationBrief({
    platform: app.platform,
    title: app.title,
    subtitle: app.subtitle,
    description: app.description,
    keywords: app.keywords.map((k) => k.term),
    discoveredKeywords: discoveredKeywords ?? (await discoverKeywordsForLocale(app, locale)),
    locale,
    limits: {
      title: TITLE_MAX[app.platform],
      subtitle: SUBTITLE_RANGE[app.platform],
      description: DESCRIPTION_IDEAL_LEN[app.platform],
    },
  });
}

/** Registers every MCP tool on a (per-session) McpServer. Tools are
 * stateless wrappers over @/lib/* and @/lib/stores, so binding fresh
 * registrations per session is safe. */
function registerTools(server: McpServer): void {
  server.registerTool(
    "list_apps",
    {
      title: "List tracked apps",
      description:
        "Lists every app currently tracked in this ASO tool, with keyword/competitor counts and the latest health score.",
      inputSchema: {},
    },
    async () => {
      const appsList = await db.query.apps.findMany({
        orderBy: [desc(apps.createdAt)],
        columns: { posthogApiKey: false },
        with: {
          keywords: { columns: { id: true } },
          competitors: { columns: { id: true } },
          healthReports: { orderBy: [desc(healthReports.createdAt)], limit: 1 },
        },
      });
      return json(
        appsList.map((a) => ({
          id: a.id,
          platform: a.platform,
          storeId: a.storeId,
          name: a.name,
          keywordCount: a.keywords.length,
          competitorCount: a.competitors.length,
          healthScore: a.healthReports[0]?.score ?? null,
        })),
      );
    },
  );

  server.registerTool(
    "search_store",
    {
      title: "Search App Store / Google Play",
      description:
        "Searches the App Store or Google Play for apps by name. Use this to find the storeId needed by add_app / add_competitor.",
      inputSchema: {
        platform: platformSchema,
        term: z.string().min(1),
        country: z.string().length(2).optional(),
      },
    },
    async ({ platform, term, country }) => {
      try {
        const results = await stores.search(platform, term, country ?? "us", 15);
        return json(results);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "add_app",
    {
      title: "Start tracking an app",
      description:
        "Adds an app (yours or a competitor's) to be tracked. storeId is the bundle id (iOS) or package name (Android) — use search_store to find it.",
      inputSchema: {
        platform: platformSchema,
        storeId: z.string().min(1),
        country: z.string().length(2).optional(),
      },
    },
    async ({ platform, storeId, country }) => {
      try {
        const app = await createApp(platform, storeId, country ?? "us");
        return json(app);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "get_app",
    {
      title: "Get app detail",
      description:
        "Returns full detail for a tracked app: metadata, tracked keywords with rank history, competitors, and latest health report.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { posthogApiKey: false },
        with: {
          keywords: { with: { ranks: { orderBy: [desc(keywordRanks.checkedAt)], limit: 10 } } },
          competitors: { with: { ranks: { orderBy: [desc(competitorRanks.checkedAt)], limit: 10 } } },
          healthReports: { orderBy: [desc(healthReports.createdAt)], limit: 1 },
        },
      });
      if (!app) return errorResult(new Error("App not found"));
      return json(app);
    },
  );

  server.registerTool(
    "sync_app",
    {
      title: "Refresh app metadata",
      description:
        "Re-fetches an app's live store metadata (title, subtitle, description, rating, screenshots, version) and recomputes its health report.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      try {
        const app = await syncAppMetadata(appId);
        return json(app);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "get_health_report",
    {
      title: "Get ASO health report",
      description:
        "Returns the health score breakdown (title, subtitle, screenshots, description, keyword coverage, ratings, freshness) and suggestions for an app. Keyword coverage checks how many of the app's tracked keywords actually appear in its title/subtitle/description. Set refresh=true to recompute from the latest stored metadata.",
      inputSchema: { appId: z.string().min(1), refresh: z.boolean().optional() },
    },
    async ({ appId, refresh }) => {
      try {
        if (!refresh) {
          const latest = await db.query.healthReports.findFirst({
            where: eq(healthReports.appId, appId),
            orderBy: [desc(healthReports.createdAt)],
          });
          if (latest) return json(latest);
        }
        const report = await recomputeHealth(appId);
        return json(report);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "add_keyword",
    {
      title: "Track a keyword",
      description:
        "Adds a keyword to track for an app and immediately records its current search rank position (and competitors' positions for that keyword). The optional country (lowercase ISO 3166-1 alpha-2, e.g. \"us\", \"de\", \"ru\") picks the storefront to track in - the storefront decides which language's search results the term competes in, so pass the market the keyword is written for. Defaults to \"us\".",
      inputSchema: {
        appId: z.string().min(1),
        term: z.string().min(1),
        country: z.string().length(2).optional(),
      },
    },
    async ({ appId, term, country }) => {
      try {
        const keyword = await addKeyword(appId, term, country?.toLowerCase());
        await recomputeHealth(appId);
        return json(keyword);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "auto_detect_keywords",
    {
      title: "Auto-detect keywords",
      description:
        "Derives keyword candidates from the app's own title and subtitle (no store search needed) and starts tracking any that aren't already tracked. Use this instead of guessing keywords manually. The optional country (lowercase ISO 3166-1 alpha-2) sets the storefront the detected keywords are tracked in; defaults to \"us\".",
      inputSchema: { appId: z.string().min(1), country: z.string().length(2).optional() },
    },
    async ({ appId, country }) => {
      try {
        const added = await autoDetectKeywords(appId, country?.toLowerCase());
        return json(added);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "list_keywords",
    {
      title: "List tracked keywords",
      description:
        "Lists an app's tracked keywords with recent rank history. Each keyword carries the storefront (country) its rank is tracked in.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      const keywordsList = await db.query.keywords.findMany({
        where: eq(keywords.appId, appId),
        with: { ranks: { orderBy: [desc(keywordRanks.checkedAt)], limit: 10 } },
      });
      return json(keywordsList);
    },
  );

  server.registerTool(
    "global_scan_keyword",
    {
      title: "Scan a keyword's rank across countries",
      description:
        "Checks the app's rank for one tracked keyword across ~40 major App Store / Google Play storefronts (not just the default one), so you can see where visibility is strong vs weak geographically. Persists results for the app's Global Reach map.",
      inputSchema: { appId: z.string().min(1), keywordId: z.string().min(1) },
    },
    async ({ appId, keywordId }) => {
      try {
        const results = await runGlobalScan(appId, keywordId);
        return json(results);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "add_competitor",
    {
      title: "Track a competitor",
      description:
        "Adds a competitor app for comparison. Once added, every future rank check also records that competitor's position for each tracked keyword (competitor spy).",
      inputSchema: { appId: z.string().min(1), platform: platformSchema, storeId: z.string().min(1) },
    },
    async ({ appId, platform, storeId }) => {
      try {
        const competitor = await addCompetitor(appId, platform, storeId);
        return json(competitor);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "list_competitors",
    {
      title: "List tracked competitors",
      description: "Lists an app's tracked competitors with their recent rank history per keyword.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      const competitorsList = await db.query.competitors.findMany({
        where: eq(competitors.appId, appId),
        with: { ranks: { orderBy: [desc(competitorRanks.checkedAt)], limit: 20 } },
      });
      return json(competitorsList);
    },
  );

  server.registerTool(
    "find_winning_keywords",
    {
      title: "Find winning keywords",
      description:
        "Generates keyword candidates from the app's and its competitors' titles/subtitles, then scores each by estimated demand (volume), competitiveness (difficulty), and the app's current live rank for that term, using live store search data. Returns the best opportunities not already tracked. Also auto-discovers and starts tracking a few competitor apps found via the same seed terms, if any new ones turn up.",
      inputSchema: { appId: z.string().min(1), limit: z.number().int().min(1).max(30).optional() },
    },
    async ({ appId, limit }) => {
      const cap = limit ?? 15;
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { posthogApiKey: false },
        with: { competitors: true, keywords: true },
      });
      if (!app) return errorResult(new Error("App not found"));

      const trackedTerms = new Set(app.keywords.map((k) => k.term));
      const seeds = [
        ...extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 6),
        ...app.competitors.flatMap((c) => extractSeedTerms(`${c.title ?? ""} ${c.subtitle ?? ""}`, 4)),
      ];
      const candidates = expandCandidates(Array.from(new Set(seeds)), cap * 2).filter(
        (term) => !trackedTerms.has(term),
      );
      const scored = await scoreKeywords(app.platform, candidates.slice(0, cap), app.storeId);
      const ranked = scored.sort((a, b) => keywordOpportunityRank(b) - keywordOpportunityRank(a));
      const newCompetitors = await autoDetectCompetitors(appId);
      return json({ keywords: ranked, newCompetitors });
    },
  );

  server.registerTool(
    "sync_reviews",
    {
      title: "Sync store reviews",
      description:
        "Fetches the app's most recent store reviews and stores any not already saved (safe to re-run - only adds new ones, never duplicates). Run this before get_review_analysis if you want fresh data.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      try {
        const result = await syncReviews(appId);
        return json(result);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "get_review_analysis",
    {
      title: "Get review analysis",
      description:
        "Rating distribution and heuristic positive/negative theme extraction (most-mentioned words) over every review stored for the app, plus a few of the most recent positive and negative reviews. Doesn't hit the store itself - call sync_reviews first for fresh data.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      try {
        const analysis = await getReviewAnalysis(appId);
        return json(analysis);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "find_review_keyword_gaps",
    {
      title: "Find keyword gaps from reviews",
      description:
        "Cross-references words real users repeat in this app's own reviews against its tracked keywords, and scores whichever ones aren't tracked yet (live store search, same volume/difficulty scoring as find_keyword_ideas). Surfaces keyword opportunities no competitor-data-only tool can see, since it's mined from this app's own first-party review text.",
      inputSchema: { appId: z.string().min(1) },
    },
    async ({ appId }) => {
      try {
        const gaps = await findReviewKeywordGaps(appId);
        return json(gaps);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "get_product_health_trend",
    {
      title: "Get ASO vs. product health trend",
      description:
        "Pairs the app's real daily active users (from its linked PostHog project) with its ASO health score over the same trailing window, so you can see whether a visibility/health change actually moved the business, not just the store listing. Returns null if the app has no PostHog project connected (see the app's Settings tab).",
      inputSchema: { appId: z.string().min(1), days: z.number().int().min(7).max(90).optional() },
    },
    async ({ appId, days }) => {
      try {
        const trend = await getProductHealthTrend(appId, days ?? 30);
        return json(trend);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "find_keyword_ideas",
    {
      title: "Discover keyword ideas",
      description:
        "Advanced keyword-idea discovery for any search term - not tied to a tracked app. Combines real store autocomplete suggestions (actual user queries) with local seed-phrase expansion, scores each candidate by estimated demand (volume) and competitiveness (difficulty), and returns which apps currently rank for it. Use this to explore the keyword space before deciding what to track or add to an app.",
      inputSchema: {
        platform: platformSchema,
        term: z.string().min(1),
        country: z.string().length(2).optional(),
        deep: z.boolean().optional().describe("Widen the candidate pool from 20 to 40 ideas."),
      },
    },
    async ({ platform, term, country, deep }) => {
      try {
        const data = await discoverKeywordIdeas(platform, term, country ?? "us", deep ?? false);
        return json(data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "check_keywords",
    {
      title: "Check specific keywords",
      description:
        "Scores one or more specific keyword terms by demand (volume, 0-100) and competitiveness (difficulty, 0-100) using live store search data. Pass appId to also get that app's current live rank for each term (adds them to nothing - read-only check). Use this to verify a shortlist of keyword ideas (e.g. from find_keyword_ideas) before committing to add_keyword.",
      inputSchema: {
        platform: platformSchema,
        terms: z.array(z.string().min(1)).min(1).max(20),
        country: z.string().length(2).optional(),
        appId: z.string().min(1).optional().describe("Tracked app id - if given, also returns its rank for each term."),
      },
    },
    async ({ platform, terms, country, appId }) => {
      try {
        const c = country ?? "us";
        if (appId) {
          const app = await db.query.apps.findFirst({
            where: eq(apps.id, appId),
            columns: { storeId: true },
          });
          if (!app) return errorResult(new Error("App not found"));
          const scored = await scoreKeywords(platform, terms, app.storeId, c);
          return json(scored);
        }
        const scored = await Promise.all(terms.map((t) => scoreKeywordIdea(platform, t, c)));
        return json(scored);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "get_ai_copy_suggestions",
    {
      title: "Get AI copy suggestions",
      description:
        `Rewrites an app's title/subtitle/description for one or more storefront locales, working its tracked keywords and real local search phrases (pulled live from that storefront's own autocomplete) in naturally rather than translating literally. English regional variants (en-gb/en-ca) keep the keywords as-is and only adapt spelling/idiom. Supported locales: ${AI_LOCALES.map((l) => l.code).join(", ")}. Omit \`locales\` to check all of them at once.\n\nIf OPENROUTER_API_KEY is set on the server, OpenRouter writes the copy directly and the result is saved and returned immediately. If it's NOT set, this doesn't fail - each such locale instead comes back with \`needsManualComposition: true\` and a \`brief\`: compose that locale's title/subtitle/description yourself (respecting the brief's limits/instructions) in your own next response, then call save_copy_suggestions with the result to persist it and finish the job - no OPENROUTER_API_KEY or extra API spend required either way.`,
      inputSchema: {
        appId: z.string().min(1),
        locales: z
          .array(z.string())
          .optional()
          .describe(`Locale codes to generate for (subset of: ${AI_LOCALES.map((l) => l.code).join(", ")}). Defaults to all.`),
      },
    },
    async ({ appId, locales }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { posthogApiKey: false },
        with: { keywords: { columns: { term: true } } },
      });
      if (!app) return errorResult(new Error("App not found"));

      const requested = locales?.length ? locales : AI_LOCALES.map((l) => l.code);
      const targets = requested
        .map((code) => AI_LOCALES.find((l) => l.code === code))
        .filter((l): l is AILocale => Boolean(l));
      if (targets.length === 0) {
        return errorResult(new Error(`No valid locales in [${requested.join(", ")}]`));
      }

      const results = await Promise.all(
        targets.map(async (locale) => {
          const discoveredKeywords = await discoverKeywordsForLocale(app, locale);
          try {
            const suggestions = await generateCopySuggestions({
              platform: app.platform,
              title: app.title,
              subtitle: app.subtitle,
              description: app.description,
              keywords: app.keywords.map((k) => k.term),
              discoveredKeywords,
              locale,
              limits: {
                title: TITLE_MAX[app.platform],
                subtitle: SUBTITLE_RANGE[app.platform],
                description: DESCRIPTION_IDEAL_LEN[app.platform],
              },
            });
            await saveCopySuggestions(appId, locale.code, suggestions, "openrouter");
            return { locale: locale.code, label: locale.label, suggestions };
          } catch (e) {
            if (e instanceof AIConfigError) {
              const brief = await buildLocaleBrief(app, locale, discoveredKeywords);
              return {
                locale: locale.code,
                label: locale.label,
                needsManualComposition: true as const,
                brief,
                instructions:
                  "No OPENROUTER_API_KEY on the server. Compose title/subtitle/description yourself from `brief` (respecting its limits and localization instructions), then call save_copy_suggestions with this locale and your copy to persist it.",
              };
            }
            return { locale: locale.code, label: locale.label, error: (e as Error).message };
          }
        }),
      );
      return json(results);
    },
  );

  server.registerTool(
    "prepare_copy_localization_brief",
    {
      title: "Prepare an AI copy localization brief (no API key needed)",
      description:
        `Returns everything needed to write localized title/subtitle/description copy for an app WITHOUT calling any external LLM - no OPENROUTER_API_KEY required. Use this when you (the calling model) will write the actual copy yourself: read the brief for each requested locale, then compose the rewritten title/subtitle/description directly in your own response, respecting each brief's character limits and localization instructions (English regional variants like en-gb/en-ca keep keywords as-is and only adapt spelling/idiom; other locales adapt keywords into the real local search term instead of translating literally). Supported locales: ${AI_LOCALES.map((l) => l.code).join(", ")}. Omit \`locales\` to get a brief for all of them.`,
      inputSchema: {
        appId: z.string().min(1),
        locales: z
          .array(z.string())
          .optional()
          .describe(`Locale codes to prepare a brief for (subset of: ${AI_LOCALES.map((l) => l.code).join(", ")}). Defaults to all.`),
      },
    },
    async ({ appId, locales }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { posthogApiKey: false },
        with: { keywords: { columns: { term: true } } },
      });
      if (!app) return errorResult(new Error("App not found"));

      const requested = locales?.length ? locales : AI_LOCALES.map((l) => l.code);
      const targets = requested
        .map((code) => AI_LOCALES.find((l) => l.code === code))
        .filter((l): l is AILocale => Boolean(l));
      if (targets.length === 0) {
        return errorResult(new Error(`No valid locales in [${requested.join(", ")}]`));
      }

      const briefs = await Promise.all(targets.map((locale) => buildLocaleBrief(app, locale)));
      return json(briefs);
    },
  );

  const copyFieldSchema = z.object({
    suggestion: z.string().min(1),
    rationale: z.string().min(1),
  });

  server.registerTool(
    "save_copy_suggestions",
    {
      title: "Save AI copy suggestions",
      description:
        "Persists title/subtitle/description copy you (the calling model) composed yourself - typically after reading prepare_copy_localization_brief - so the app's AI Copy Suggestions panel in the web UI shows them immediately, with no OPENROUTER_API_KEY needed. Overwrites any previously saved suggestions for the same app+locale (from either source).",
      inputSchema: {
        appId: z.string().min(1),
        locale: z.string().min(1),
        title: copyFieldSchema,
        subtitle: copyFieldSchema,
        description: copyFieldSchema,
      },
    },
    async ({ appId, locale, title, subtitle, description }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { title: true, subtitle: true, description: true },
      });
      if (!app) return errorResult(new Error("App not found"));
      if (!AI_LOCALES.some((l) => l.code === locale)) {
        return errorResult(new Error(`Unsupported locale "${locale}" (expected one of: ${AI_LOCALES.map((l) => l.code).join(", ")})`));
      }

      const suggestions: CopySuggestion[] = [
        { field: "title", current: app.title ?? "", suggestion: title.suggestion, rationale: title.rationale },
        {
          field: "subtitle",
          current: app.subtitle ?? "",
          suggestion: subtitle.suggestion,
          rationale: subtitle.rationale,
        },
        {
          field: "description",
          current: app.description ?? "",
          suggestion: description.suggestion,
          rationale: description.rationale,
        },
      ];

      const saved = await saveCopySuggestions(appId, locale, suggestions, "mcp");
      return json(saved);
    },
  );

  server.registerTool(
    "track_now",
    {
      title: "Run rank tracking now",
      description:
        "Runs a full tracking pass immediately for every app: refreshes metadata/health, and records a new keyword + competitor rank position for today. Normally this runs once a day on a schedule.",
      inputSchema: {},
    },
    async () => {
      const summary = await runDailyTracking();
      return json(summary);
    },
  );
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport (stateful sessions)
// ---------------------------------------------------------------------------

/** Same JSON-RPC error body shape the SDK transport itself (and the previous
 * adapter) returns for protocol-level rejections. */
function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface McpSession {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}

/** In-memory sessions keyed by the mcp-session-id the transport generates and
 * returns as a response header on initialize. */
const sessions = new Map<string, McpSession>();

async function createSession(): Promise<McpSession> {
  const server = new McpServer({ name: "aso-copilot", version: "0.1.0" });
  registerTools(server);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server });
    },
    // Fires when a DELETE terminates the session (transport.close()).
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  await server.connect(transport);
  return { transport, server };
}

const app = new Hono();

// Optional bearer-token gate, same shared-secret pattern as /api/track's
// CRON_SECRET. Off by default (MCP_AUTH_TOKEN unset) to match this repo's
// documented "no auth on this endpoint by default" - set it before exposing
// the app beyond localhost, since this endpoint otherwise has full
// read/write access to your ASO data. A full OAuth flow would need a
// resource-metadata endpoint this single-user tool has no use for - a shared
// secret matches the rest of the app. (Same coverage as the old route:
// GET/POST/DELETE.)
app.use("/", async (c, next) => {
  const token = process.env.MCP_AUTH_TOKEN;
  if (token && c.req.header("authorization") !== `Bearer ${token}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

// POST: JSON-RPC message endpoint. An initialize request creates a fresh
// transport+server pair and returns a new mcp-session-id; every other
// request is routed to the transport that owns the session id in the
// mcp-session-id header (unknown/missing -> 400, per the SDK's stateful
// example). Accept/Content-Type validation, protocol negotiation and the
// SSE-vs-JSON response shape all live in the transport itself.
app.post("/", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return jsonRpcError(400, -32000, "Bad Request: Invalid or missing session ID");
    }
    return session.transport.handleRequest(c.req.raw);
  }

  const body = await c.req.json().catch(() => null);
  if (isInitializeRequest(body)) {
    const session = await createSession();
    return session.transport.handleRequest(c.req.raw, { parsedBody: body });
  }
  return jsonRpcError(400, -32000, "Bad Request: Mcp-Session-Id header is required");
});

// GET: the server never emits server-initiated notifications, so there is no
// standalone SSE stream to open - 405, the same JSON-RPC error body the old
// adapter returned for GET on the streamable endpoint (and the
// SDK's own "method not allowed" shape).
app.get("/", (c) =>
  jsonRpcError(405, -32000, "Method not allowed."),
);

// DELETE: session termination per the SDK pattern - the transport validates
// the session id, fires onsessionclosed, closes itself (which closes the
// McpServer too) and answers 200.
app.delete("/", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId || !sessions.has(sessionId)) {
    return jsonRpcError(404, -32001, "Not Found: Invalid or missing session ID");
  }
  const session = sessions.get(sessionId)!;
  sessions.delete(sessionId);
  return session.transport.handleRequest(c.req.raw);
});

export default app;
