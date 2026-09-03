import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  apps,
  competitors,
  competitorRanks,
  healthReports,
  keywords,
  keywordCountryRanks,
  keywordRanks,
  reviews,
} from "@/db/schema";
import * as stores from "@/lib/stores";
import type { StorePlatform, StoreListing } from "@/lib/stores/types";
import { computeHealthReport } from "@/lib/health";
import { extractSeedTerms, scoreKeywordIdea } from "@/lib/research";
import {
  computeReviewAnalysis,
  GENERIC_SENTIMENT_WORDS,
  type ReviewAnalysis,
} from "@/lib/reviewAnalysis";
import { fetchDailyActiveUsers } from "@/lib/posthogIntegration";
import { SCAN_COUNTRIES } from "@/lib/countries";

const DEFAULT_COUNTRY = "us";

type App = Omit<typeof apps.$inferSelect, "posthogApiKey">;
type Keyword = typeof keywords.$inferSelect;
type Competitor = typeof competitors.$inferSelect;

// posthogApiKey is a secret credential - it is never selected (see APP_COLUMNS
// / findApp below) so it can never leak through a spread `...app` response
// (REST or MCP). The one place that needs it (verifying/using the PostHog
// connection, getProductHealthTrend) selects it explicitly.
const APP_COLUMNS = {
  id: apps.id,
  platform: apps.platform,
  storeId: apps.storeId,
  name: apps.name,
  country: apps.country,
  developer: apps.developer,
  iconUrl: apps.iconUrl,
  url: apps.url,
  category: apps.category,
  rating: apps.rating,
  ratingCount: apps.ratingCount,
  title: apps.title,
  subtitle: apps.subtitle,
  description: apps.description,
  screenshotCount: apps.screenshotCount,
  screenshotUrls: apps.screenshotUrls,
  languageCount: apps.languageCount,
  version: apps.version,
  lastUpdated: apps.lastUpdated,
  pinned: apps.pinned,
  createdAt: apps.createdAt,
  updatedAt: apps.updatedAt,
  posthogHost: apps.posthogHost,
  posthogProjectId: apps.posthogProjectId,
  posthogConnectedAt: apps.posthogConnectedAt,
} as const;

/** Fire-and-forget stand-in for the old Next.js after() helper: the awaited
 * work runs only once the caller resolves, without ever surfacing a rejection. */
const after = (p: Promise<unknown>) => {
  void p.catch(() => {});
};

async function findApp(id: string): Promise<App> {
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
    columns: { posthogApiKey: false },
  });
  if (!app) throw new Error(`App ${id} not found`);
  return app;
}

async function findKeyword(id: string): Promise<Keyword> {
  const keyword = await db.query.keywords.findFirst({ where: eq(keywords.id, id) });
  if (!keyword) throw new Error(`Keyword ${id} not found`);
  return keyword;
}

function appCreateData(platform: StorePlatform, listing: StoreListing, country: string) {
  return {
    platform,
    storeId: listing.storeId,
    name: listing.name,
    // Home storefront the app was added for - later the fallback for the
    // global country selector and the storefront of the daily sync pass.
    country,
    developer: listing.developer,
    iconUrl: listing.iconUrl,
    url: listing.url,
    category: listing.category,
    rating: listing.rating,
    ratingCount: listing.ratingCount,
    title: listing.title,
    subtitle: listing.subtitle,
    description: listing.description,
    screenshotCount: listing.screenshotCount,
    screenshotUrls: listing.screenshotUrls,
    languageCount: listing.languageCount,
    version: listing.version,
    lastUpdated: listing.lastUpdated,
  };
}

export async function createApp(
  platform: StorePlatform,
  storeId: string,
  country = DEFAULT_COUNTRY,
) {
  const listing = await stores.getListing(platform, storeId, country);
  if (!listing) throw new Error("App not found on the store");

  const [app] = await db
    .insert(apps)
    .values(appCreateData(platform, listing, country))
    .returning(APP_COLUMNS);

  await autoDetectKeywords(app.id, country);
  return app;
}

export type CreateAppProgressEvent =
  | {
      stage: "listing";
      name: string;
      iconUrl: string | null;
      developer: string | null;
      subtitle: string | null;
      category: string | null;
    }
  | { stage: "app_created"; appId: string }
  | { stage: "keyword"; term: string; rank: number | null }
  | { stage: "competitor"; name: string; iconUrl: string | null }
  | { stage: "health"; score: number }
  | { stage: "done"; appId: string };

/** Same end result as createApp, but yields a progress event after each real
 * step completes (metadata fetched, each keyword's rank checked, each
 * competitor found, health scored) instead of resolving once at the end. This
 * also runs competitor auto-detection, which plain createApp doesn't - a
 * human watching this live is better served seeing competitors surface too,
 * whereas existing non-interactive callers (MCP, the plain "Add App" form)
 * don't need the extra store search calls. Powers the "watch it happen" add-
 * app flow so a user sees their app's own keywords/competitors get discovered
 * in real time instead of staring at a blank spinner for several seconds. */
export async function* createAppWithProgress(
  platform: StorePlatform,
  storeId: string,
  country = DEFAULT_COUNTRY,
): AsyncGenerator<CreateAppProgressEvent> {
  const listing = await stores.getListing(platform, storeId, country);
  if (!listing) throw new Error("App not found on the store");

  yield {
    stage: "listing",
    name: listing.name,
    iconUrl: listing.iconUrl,
    developer: listing.developer,
    subtitle: listing.subtitle,
    category: listing.category,
  };

  const [app] = await db
    .insert(apps)
    .values(appCreateData(platform, listing, country))
    .returning(APP_COLUMNS);
  yield { stage: "app_created", appId: app.id };

  for await (const { keyword, rank } of autoDetectKeywordsGen(app.id, country)) {
    yield { stage: "keyword", term: keyword.term, rank };
  }

  for await (const competitor of autoDetectCompetitorsGen(app.id, country)) {
    yield { stage: "competitor", name: competitor.name, iconUrl: competitor.iconUrl };
  }

  const report = await recomputeHealth(app.id);
  yield { stage: "health", score: report.score };

  yield { stage: "done", appId: app.id };
}

/** Re-fetches the app's live listing. The storefront defaults to the app's
 * own home country (apps.country), so an explicit sync without a country
 * refreshes the market the app was added for rather than a hardcoded "us". */
export async function syncAppMetadata(appId: string, country?: string) {
  const app = await findApp(appId);
  const listing = await stores.getListing(app.platform, app.storeId, country ?? app.country);
  if (!listing) return app;

  const [updated] = await db
    .update(apps)
    .set({
      name: listing.name,
      developer: listing.developer,
      iconUrl: listing.iconUrl,
      url: listing.url,
      category: listing.category,
      rating: listing.rating,
      ratingCount: listing.ratingCount,
      title: listing.title,
      subtitle: listing.subtitle,
      description: listing.description,
      screenshotCount: listing.screenshotCount,
      screenshotUrls: listing.screenshotUrls,
      languageCount: listing.languageCount,
      version: listing.version,
      lastUpdated: listing.lastUpdated,
    })
    .where(eq(apps.id, appId))
    .returning(APP_COLUMNS);

  await recomputeHealth(appId);
  return updated;
}

export async function recomputeHealth(appId: string) {
  const app = await findApp(appId);
  const appCompetitors = await db.query.competitors.findMany({
    where: eq(competitors.appId, appId),
  });
  const appKeywords = await db.query.keywords.findMany({
    where: eq(keywords.appId, appId),
    columns: { term: true },
  });

  const report = computeHealthReport(
    {
      platform: app.platform,
      title: app.title,
      subtitle: app.subtitle,
      description: app.description,
      screenshotCount: app.screenshotCount,
      rating: app.rating,
      ratingCount: app.ratingCount,
      lastUpdated: app.lastUpdated,
      languageCount: app.languageCount,
      keywordTerms: appKeywords.map((k) => k.term),
    },
    appCompetitors.map((c) => ({ name: c.name, ratingCount: c.ratingCount })),
  );

  const [saved] = await db
    .insert(healthReports)
    .values({
      appId,
      score: report.score,
      breakdown: report.breakdown as unknown as object,
      suggestions: report.suggestions as unknown as object,
    })
    .returning();
  return saved;
}

export async function addKeyword(appId: string, term: string, country = DEFAULT_COUNTRY) {
  const [keyword] = await db
    .insert(keywords)
    .values({ appId, term: term.trim().toLowerCase(), country })
    .returning();

  // Rank lookups hit live store search for the app + every competitor, which
  // can take a few seconds - don't make the caller wait on that.
  after(
    (async () => {
      const app = await findApp(appId);
      await trackKeyword(app, keyword.id);
    })(),
  );

  return keyword;
}

/** Same detection as autoDetectKeywords, but yields each keyword as its rank
 * lookup completes instead of returning them all at once - lets a caller
 * (e.g. the live "adding your app" progress stream) show results arriving
 * one at a time instead of a single delayed dump at the end. */
async function* autoDetectKeywordsGen(
  appId: string,
  country = DEFAULT_COUNTRY,
): AsyncGenerator<{ keyword: Keyword; rank: number | null }> {
  const app = await findApp(appId);
  // Dedupe per storefront: the same term tracked for another country is a
  // different keyword and shouldn't suppress detection here.
  const existing = await db.query.keywords.findMany({
    where: eq(keywords.appId, appId),
    columns: { term: true, country: true },
  });
  const existingKeys = new Set(existing.map((k) => `${k.term}\u0000${k.country}`));

  const seeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 8);
  const newTerms = seeds.filter((term) => !existingKeys.has(`${term}\u0000${country}`));

  for (const term of newTerms) {
    try {
      const [keyword] = await db.insert(keywords).values({ appId, term, country }).returning();
      const rank = await trackKeyword(app, keyword.id);
      yield { keyword, rank };
    } catch {
      // unique constraint races or store hiccups shouldn't block the rest
    }
  }
}

/** Derives candidate keywords straight from the app's own title/subtitle
 * (no store search calls needed), starts tracking any that aren't already
 * tracked, and immediately syncs rank positions for them (unlike addKeyword,
 * which defers that to run after the response). Used on app creation and as
 * an on-demand "find keywords for me" action, since most users don't know
 * which terms to track yet - by the time this resolves the new keywords
 * already have real rank data, not a "Not ranked" placeholder. */
export async function autoDetectKeywords(appId: string, country = DEFAULT_COUNTRY) {
  const added: Keyword[] = [];
  for await (const { keyword } of autoDetectKeywordsGen(appId, country)) {
    added.push(keyword);
  }

  await recomputeHealth(appId);
  return added;
}

/** Records the app's (and every competitor's) current rank for one keyword.
 * The storefront is always the keyword's own `country` - it travels with the
 * keyword row, so callers can't accidentally check a US rank for a keyword
 * the user added for the German storefront. */
async function trackKeyword(app: App, keywordId: string): Promise<number | null> {
  const keyword = await findKeyword(keywordId);
  const position = await stores.findRank(app.platform, keyword.term, app.storeId, keyword.country);
  await db.insert(keywordRanks).values({ keywordId, position });

  const appCompetitors = await db.query.competitors.findMany({
    where: eq(competitors.appId, app.id),
  });
  for (const competitor of appCompetitors) {
    await trackCompetitorForKeyword(competitor, keyword.id, keyword.term, keyword.country);
  }
  return position;
}

async function trackCompetitorForKeyword(
  competitor: Competitor,
  keywordId: string,
  term: string,
  country = DEFAULT_COUNTRY,
) {
  const position = await stores.findRank(competitor.platform, term, competitor.storeId, country);
  await db.insert(competitorRanks).values({ competitorId: competitor.id, keywordId, position });
}

/** Same detection as autoDetectCompetitors, but yields each competitor as
 * it's added instead of returning them all at once - see
 * autoDetectKeywordsGen for why. */
async function* autoDetectCompetitorsGen(
  appId: string,
  country = DEFAULT_COUNTRY,
): AsyncGenerator<Competitor> {
  const app = await findApp(appId);
  const existing = await db.query.competitors.findMany({
    where: eq(competitors.appId, appId),
    columns: { storeId: true },
  });
  const existingIds = new Set(existing.map((c) => c.storeId));

  const seeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 3);
  const hitsBySeed = await Promise.all(
    seeds.map((seed) => stores.search(app.platform, seed, country, 10)),
  );

  const candidates = new Map<string, number>();
  for (const hits of hitsBySeed) {
    for (const hit of hits) {
      if (hit.storeId === app.storeId || existingIds.has(hit.storeId)) continue;
      candidates.set(hit.storeId, (candidates.get(hit.storeId) ?? 0) + 1);
    }
  }

  const ranked = Array.from(candidates.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([storeId]) => storeId);

  for (const storeId of ranked) {
    try {
      yield await addCompetitor(appId, app.platform, storeId, country);
    } catch {
      // unique constraint races or store hiccups shouldn't block the rest
    }
  }
}

/** Derives competitor candidates from live store search results for the
 * app's own title/subtitle seeds (the same apps a user would find searching
 * for their own core terms), and starts tracking whichever ones aren't
 * already tracked. An app that shows up for multiple seed terms is ranked
 * higher since that's a stronger competitor signal than a single incidental
 * match. Used as a "find competitors for me" follow-up to keyword research,
 * since most users don't know who else to compare against yet. */
export async function autoDetectCompetitors(appId: string, country = DEFAULT_COUNTRY) {
  const added: Competitor[] = [];
  for await (const competitor of autoDetectCompetitorsGen(appId, country)) {
    added.push(competitor);
  }
  return added;
}

export async function addCompetitor(
  appId: string,
  platform: StorePlatform,
  storeId: string,
  country = DEFAULT_COUNTRY,
) {
  const listing = await stores.getListing(platform, storeId, country);
  if (!listing) throw new Error("Competitor app not found on the store");

  const [competitor] = await db
    .insert(competitors)
    .values({
      appId,
      platform,
      storeId: listing.storeId,
      name: listing.name,
      // Storefront the competitor is compared in - part of its identity, so
      // the same store app can be tracked as a competitor in several markets.
      country,
      iconUrl: listing.iconUrl,
      rating: listing.rating,
      ratingCount: listing.ratingCount,
      title: listing.title,
      subtitle: listing.subtitle,
      description: listing.description,
      screenshotCount: listing.screenshotCount,
      screenshotUrls: listing.screenshotUrls,
      lastUpdated: listing.lastUpdated,
      lastSyncedAt: new Date(),
    })
    .returning();

  // The competitor itself is already saved and visible; back-filling its rank
  // for every existing keyword is the slow part, so it runs after the response.
  await recomputeHealth(appId);
  after(
    (async () => {
      const appKeywords = await db.query.keywords.findMany({ where: eq(keywords.appId, appId) });
      for (const keyword of appKeywords) {
        try {
          await trackCompetitorForKeyword(competitor, keyword.id, keyword.term, keyword.country);
        } catch {
          // best-effort backfill, a failed keyword shouldn't block the rest
        }
      }
    })(),
  );

  return competitor;
}

export interface CountryRankResult {
  country: string;
  position: number | null;
}

/** Deep scan: checks the app's rank for one keyword across every storefront
 * in SCAN_COUNTRIES, in parallel. A country the store search fails for is
 * just dropped (rendered as "not scanned" on the map) rather than failing
 * the whole scan, matching the tolerant pattern already used for scoring
 * keyword candidates in src/lib/research.ts. */
export async function runGlobalScan(
  appId: string,
  keywordId: string,
): Promise<CountryRankResult[]> {
  const [app, keyword] = await Promise.all([findApp(appId), findKeyword(keywordId)]);

  const settled = await Promise.allSettled(
    SCAN_COUNTRIES.map(async (country) => ({
      country,
      position: await stores.findRank(app.platform, keyword.term, app.storeId, country),
    })),
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<CountryRankResult> => r.status === "fulfilled")
    .map((r) => r.value);

  if (results.length > 0) {
    await db
      .insert(keywordCountryRanks)
      .values(results.map((r) => ({ keywordId, country: r.country, position: r.position })));
  }

  return results;
}

/** Most recent scanned position per country for a keyword, so the map can
 * render already-known data on load without re-scanning every visit. */
export async function getLatestGlobalScan(keywordId: string): Promise<CountryRankResult[]> {
  const rows = await db.query.keywordCountryRanks.findMany({
    where: eq(keywordCountryRanks.keywordId, keywordId),
    orderBy: [desc(keywordCountryRanks.checkedAt)],
  });

  const seen = new Set<string>();
  const latest: CountryRankResult[] = [];
  for (const row of rows) {
    if (seen.has(row.country)) continue;
    seen.add(row.country);
    latest.push({ country: row.country, position: row.position });
  }
  return latest;
}

/** Fetches the app's most recent store reviews and persists any not already
 * stored (deduped by the store's own review id via `[appId, externalId]`).
 * Safe to call repeatedly - re-syncing only ever adds new reviews, since
 * store review text/rating don't change after the fact. */
export async function syncReviews(appId: string, country = DEFAULT_COUNTRY) {
  const app = await findApp(appId);
  const storeReviews = await stores.fetchReviews(app.platform, app.storeId, country);
  if (storeReviews.length === 0) return { fetched: 0, synced: 0 };

  const inserted = await db
    .insert(reviews)
    .values(
      storeReviews.map((r) => ({
        appId,
        externalId: r.externalId,
        rating: r.rating,
        title: r.title,
        text: r.text,
        authorName: r.authorName,
        version: r.version,
        country,
        reviewedAt: r.reviewedAt,
      })),
    )
    // ON CONFLICT DO NOTHING without a target, like Prisma's skipDuplicates.
    .onConflictDoNothing()
    .returning({ id: reviews.id });
  return { fetched: storeReviews.length, synced: inserted.length };
}

/** Rating distribution + heuristic positive/negative theme extraction over
 * every review stored for the app so far. Doesn't hit the store itself - call
 * syncReviews first (or pass refresh through the API route) to pull new ones.
 * With `country`, only reviews synced for that storefront are aggregated -
 * review language and sentiment differ per market, so a per-country view is
 * the meaningful one for the global selector. */
export async function getReviewAnalysis(appId: string, country?: string): Promise<ReviewAnalysis> {
  const [app, reviewRows] = await Promise.all([
    db.query.apps.findFirst({ where: eq(apps.id, appId), columns: { name: true } }),
    db.query.reviews.findMany({
      where: country
        ? and(eq(reviews.appId, appId), eq(reviews.country, country))
        : eq(reviews.appId, appId),
    }),
  ]);
  if (!app) throw new Error(`App ${appId} not found`);
  return computeReviewAnalysis(reviewRows, app.name);
}

export interface ReviewKeywordGap {
  term: string;
  mentions: number;
  volume: number;
  difficulty: number;
}

const MAX_GAP_CANDIDATES = 8;

/** Cross-references words users actually mention in reviews (already surfaced
 * as review "themes") against the app's tracked keywords - a word real users
 * repeat to describe the app that isn't targeted yet is a keyword opportunity
 * no competitor tool can see, since none of them mine your own review text
 * for keyword discovery. Scores each untracked term the same way keyword
 * research does (live store search), so it's directly comparable/actionable,
 * not just a raw word list. */
export async function findReviewKeywordGaps(
  appId: string,
  country = DEFAULT_COUNTRY,
): Promise<ReviewKeywordGap[]> {
  const [app, existingKeywords, analysis] = await Promise.all([
    findApp(appId),
    db.query.keywords.findMany({
      where: eq(keywords.appId, appId),
      columns: { term: true, country: true },
    }),
    getReviewAnalysis(appId, country),
  ]);
  // A term tracked for any storefront counts as targeted - the gap list is
  // about missed words, not missed per-market coverage.
  const trackedTerms = new Set(existingKeywords.map((k) => k.term));

  const mentionCounts = new Map<string, number>();
  for (const t of [...analysis.positiveThemes, ...analysis.negativeThemes]) {
    mentionCounts.set(t.term, (mentionCounts.get(t.term) ?? 0) + t.count);
  }

  const candidates = Array.from(mentionCounts.entries())
    .filter(([term]) => !trackedTerms.has(term) && !GENERIC_SENTIMENT_WORDS.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GAP_CANDIDATES);

  const settled = await Promise.allSettled(
    candidates.map(async ([term, mentions]): Promise<ReviewKeywordGap> => {
      const idea = await scoreKeywordIdea(app.platform, term, country);
      return { term, mentions, volume: idea.volume, difficulty: idea.difficulty };
    }),
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<ReviewKeywordGap> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.volume - a.volume);
}

export interface ProductHealthPoint {
  date: string; // "YYYY-MM-DD"
  dau: number | null;
  healthScore: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pairs the app's real product usage (daily active users, from its linked
 * PostHog project) with its ASO health score history over the same window -
 * no ASO tool has access to this since none of them integrate with a
 * product-analytics platform. Returns null if PostHog isn't connected, so the
 * caller can render a "connect PostHog" prompt instead of an empty chart. */
export async function getProductHealthTrend(
  appId: string,
  days = 30,
): Promise<ProductHealthPoint[] | null> {
  // The only query allowed to pull the API credential - everything else
  // selects around it (APP_COLUMNS / findApp).
  const creds = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
    columns: { posthogHost: true, posthogProjectId: true, posthogApiKey: true },
  });
  if (!creds) throw new Error(`App ${appId} not found`);
  if (!creds.posthogHost || !creds.posthogProjectId || !creds.posthogApiKey) return null;

  const windowStart = new Date(Date.now() - days * DAY_MS);
  const [dauPoints, priorReports, healthReportRows] = await Promise.all([
    fetchDailyActiveUsers(
      { host: creds.posthogHost, projectId: creds.posthogProjectId, apiKey: creds.posthogApiKey },
      days,
    ),
    db
      .select({ score: healthReports.score })
      .from(healthReports)
      .where(and(eq(healthReports.appId, appId), lt(healthReports.createdAt, windowStart)))
      .orderBy(desc(healthReports.createdAt))
      .limit(1),
    db
      .select({ score: healthReports.score, createdAt: healthReports.createdAt })
      .from(healthReports)
      .where(and(eq(healthReports.appId, appId), gte(healthReports.createdAt, windowStart)))
      .orderBy(asc(healthReports.createdAt)),
  ]);
  if (dauPoints === null) return null;
  const priorReport = priorReports[0];

  const scoreByDate = new Map<string, number>();
  for (const r of healthReportRows) {
    scoreByDate.set(r.createdAt.toISOString().slice(0, 10), r.score);
  }

  let lastKnownScore: number | null = priorReport?.score ?? null;
  return dauPoints.map((p) => {
    if (scoreByDate.has(p.day)) lastKnownScore = scoreByDate.get(p.day)!;
    return { date: p.day, dau: p.dau, healthScore: lastKnownScore };
  });
}

/** Runs the full daily pass for every tracked app: refresh metadata, health
 * score, and keyword/competitor rank positions. Meant to be triggered once a
 * day by an external cron hitting POST /api/track. Metadata and reviews use
 * each app's own home storefront (app.country) - keywords always use their
 * own keyword.country, see the loop below. */
export async function runDailyTracking() {
  const trackedApps = await db.query.apps.findMany({ columns: { posthogApiKey: false } });
  const summary = {
    apps: 0,
    keywordsTracked: 0,
    competitorsTracked: 0,
    reviewsSynced: 0,
    errors: [] as string[],
  };

  for (const app of trackedApps) {
    try {
      await syncAppMetadata(app.id, app.country);
      summary.apps += 1;

      try {
        const { synced } = await syncReviews(app.id, app.country);
        summary.reviewsSynced += synced;
      } catch (e) {
        summary.errors.push(`reviews (${app.name}): ${(e as Error).message}`);
      }

      const appKeywords = await db.query.keywords.findMany({ where: eq(keywords.appId, app.id) });
      const appCompetitors = await db.query.competitors.findMany({
        where: eq(competitors.appId, app.id),
      });

      // Each keyword is checked in its own storefront, not the app's home
      // country - a keyword added for the Russian storefront must keep being
      // tracked there even though metadata/reviews use the app's storefront.
      for (const keyword of appKeywords) {
        try {
          const position = await stores.findRank(
            app.platform,
            keyword.term,
            app.storeId,
            keyword.country,
          );
          await db.insert(keywordRanks).values({ keywordId: keyword.id, position });
          summary.keywordsTracked += 1;

          for (const competitor of appCompetitors) {
            try {
              await trackCompetitorForKeyword(
                competitor,
                keyword.id,
                keyword.term,
                keyword.country,
              );
              summary.competitorsTracked += 1;
            } catch (e) {
              summary.errors.push(
                `competitor ${competitor.name}/${keyword.term}: ${(e as Error).message}`,
              );
            }
          }
        } catch (e) {
          summary.errors.push(
            `keyword ${keyword.term}/${keyword.country} (${app.name}): ${(e as Error).message}`,
          );
        }
      }
    } catch (e) {
      summary.errors.push(`app ${app.name}: ${(e as Error).message}`);
    }
  }

  return summary;
}
