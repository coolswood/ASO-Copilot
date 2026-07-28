import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import * as stores from "@/lib/stores";
import type { StorePlatform, StoreListing } from "@/lib/stores/types";
import { computeHealthReport } from "@/lib/health";
import { extractSeedTerms, scoreKeywordIdea } from "@/lib/research";
import { computeReviewAnalysis, GENERIC_SENTIMENT_WORDS, type ReviewAnalysis } from "@/lib/reviewAnalysis";
import { fetchDailyActiveUsers } from "@/lib/posthogIntegration";
import { SCAN_COUNTRIES } from "@/lib/countries";
import type { App, Competitor } from "@/generated/prisma/client";

const DEFAULT_COUNTRY = "us";

function appCreateData(platform: StorePlatform, listing: StoreListing) {
  return {
    platform,
    storeId: listing.storeId,
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
  };
}

export async function createApp(platform: StorePlatform, storeId: string, country = DEFAULT_COUNTRY) {
  const listing = await stores.getListing(platform, storeId, country);
  if (!listing) throw new Error("App not found on the store");

  const app = await prisma.app.create({ data: appCreateData(platform, listing) });

  await autoDetectKeywords(app.id, country);
  return app;
}

export type CreateAppProgressEvent =
  | { stage: "listing"; name: string; iconUrl: string | null; developer: string | null; subtitle: string | null; category: string | null }
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

  const app = await prisma.app.create({ data: appCreateData(platform, listing) });
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

export async function syncAppMetadata(appId: string, country = DEFAULT_COUNTRY) {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const listing = await stores.getListing(app.platform, app.storeId, country);
  if (!listing) return app;

  const updated = await prisma.app.update({
    where: { id: appId },
    data: {
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
    },
  });

  await recomputeHealth(appId);
  return updated;
}

export async function recomputeHealth(appId: string) {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const competitors = await prisma.competitor.findMany({ where: { appId } });
  const keywords = await prisma.keyword.findMany({ where: { appId }, select: { term: true } });

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
      keywordTerms: keywords.map((k) => k.term),
    },
    competitors.map((c) => ({ name: c.name, ratingCount: c.ratingCount })),
  );

  return prisma.healthReport.create({
    data: {
      appId,
      score: report.score,
      breakdown: report.breakdown as unknown as object,
      suggestions: report.suggestions as unknown as object,
    },
  });
}

export async function addKeyword(appId: string, term: string, country = DEFAULT_COUNTRY) {
  const keyword = await prisma.keyword.create({
    data: { appId, term: term.trim().toLowerCase() },
  });

  // Rank lookups hit live store search for the app + every competitor, which
  // can take a few seconds - don't make the caller wait on that.
  after(async () => {
    const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
    await trackKeyword(app, keyword.id, country);
  });

  return keyword;
}

/** Same detection as autoDetectKeywords, but yields each keyword as its rank
 * lookup completes instead of returning them all at once - lets a caller
 * (e.g. the live "adding your app" progress stream) show results arriving
 * one at a time instead of a single delayed dump at the end. */
async function* autoDetectKeywordsGen(
  appId: string,
  country = DEFAULT_COUNTRY,
): AsyncGenerator<{ keyword: Awaited<ReturnType<typeof prisma.keyword.create>>; rank: number | null }> {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const existing = await prisma.keyword.findMany({ where: { appId }, select: { term: true } });
  const existingTerms = new Set(existing.map((k) => k.term));

  const seeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 8);
  const newTerms = seeds.filter((term) => !existingTerms.has(term));

  for (const term of newTerms) {
    try {
      const keyword = await prisma.keyword.create({ data: { appId, term } });
      const rank = await trackKeyword(app, keyword.id, country);
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
  const added: Awaited<ReturnType<typeof prisma.keyword.create>>[] = [];
  for await (const { keyword } of autoDetectKeywordsGen(appId, country)) {
    added.push(keyword);
  }

  await recomputeHealth(appId);
  return added;
}

async function trackKeyword(app: App, keywordId: string, country = DEFAULT_COUNTRY): Promise<number | null> {
  const keyword = await prisma.keyword.findUniqueOrThrow({ where: { id: keywordId } });
  const position = await stores.findRank(app.platform, keyword.term, app.storeId, country);
  await prisma.keywordRank.create({ data: { keywordId, position } });

  const competitors = await prisma.competitor.findMany({ where: { appId: app.id } });
  for (const competitor of competitors) {
    await trackCompetitorForKeyword(competitor, keyword.id, keyword.term, country);
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
  await prisma.competitorRank.create({ data: { competitorId: competitor.id, keywordId, position } });
}

/** Same detection as autoDetectCompetitors, but yields each competitor as
 * it's added instead of returning them all at once - see
 * autoDetectKeywordsGen for why. */
async function* autoDetectCompetitorsGen(appId: string, country = DEFAULT_COUNTRY): AsyncGenerator<Competitor> {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const existing = await prisma.competitor.findMany({ where: { appId }, select: { storeId: true } });
  const existingIds = new Set(existing.map((c) => c.storeId));

  const seeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 3);
  const hitsBySeed = await Promise.all(seeds.map((seed) => stores.search(app.platform, seed, country, 10)));

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

  const competitor = await prisma.competitor.create({
    data: {
      appId,
      platform,
      storeId: listing.storeId,
      name: listing.name,
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
    },
  });

  // The competitor itself is already saved and visible; back-filling its rank
  // for every existing keyword is the slow part, so it runs after the response.
  await recomputeHealth(appId);
  after(async () => {
    const keywords = await prisma.keyword.findMany({ where: { appId } });
    for (const keyword of keywords) {
      try {
        await trackCompetitorForKeyword(competitor, keyword.id, keyword.term, country);
      } catch {
        // best-effort backfill, a failed keyword shouldn't block the rest
      }
    }
  });

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
export async function runGlobalScan(appId: string, keywordId: string): Promise<CountryRankResult[]> {
  const [app, keyword] = await Promise.all([
    prisma.app.findUniqueOrThrow({ where: { id: appId } }),
    prisma.keyword.findUniqueOrThrow({ where: { id: keywordId } }),
  ]);

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
    await prisma.keywordCountryRank.createMany({
      data: results.map((r) => ({ keywordId, country: r.country, position: r.position })),
    });
  }

  return results;
}

/** Most recent scanned position per country for a keyword, so the map can
 * render already-known data on load without re-scanning every visit. */
export async function getLatestGlobalScan(keywordId: string): Promise<CountryRankResult[]> {
  const rows = await prisma.keywordCountryRank.findMany({
    where: { keywordId },
    orderBy: { checkedAt: "desc" },
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
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const reviews = await stores.fetchReviews(app.platform, app.storeId, country);
  if (reviews.length === 0) return { fetched: 0, synced: 0 };

  const result = await prisma.review.createMany({
    data: reviews.map((r) => ({
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
    skipDuplicates: true,
  });
  return { fetched: reviews.length, synced: result.count };
}

/** Rating distribution + heuristic positive/negative theme extraction over
 * every review stored for the app so far. Doesn't hit the store itself - call
 * syncReviews first (or pass refresh through the API route) to pull new ones. */
export async function getReviewAnalysis(appId: string): Promise<ReviewAnalysis> {
  const [app, reviews] = await Promise.all([
    prisma.app.findUniqueOrThrow({ where: { id: appId }, select: { name: true } }),
    prisma.review.findMany({ where: { appId } }),
  ]);
  return computeReviewAnalysis(reviews, app.name);
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
export async function findReviewKeywordGaps(appId: string, country = DEFAULT_COUNTRY): Promise<ReviewKeywordGap[]> {
  const [app, existingKeywords, analysis] = await Promise.all([
    prisma.app.findUniqueOrThrow({ where: { id: appId } }),
    prisma.keyword.findMany({ where: { appId }, select: { term: true } }),
    getReviewAnalysis(appId),
  ]);
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
export async function getProductHealthTrend(appId: string, days = 30): Promise<ProductHealthPoint[] | null> {
  const app = await prisma.app.findUniqueOrThrow({
    where: { id: appId },
    omit: { posthogApiKey: false },
  });
  if (!app.posthogHost || !app.posthogProjectId || !app.posthogApiKey) return null;

  const windowStart = new Date(Date.now() - days * DAY_MS);
  const [dauPoints, priorReport, healthReports] = await Promise.all([
    fetchDailyActiveUsers(
      { host: app.posthogHost, projectId: app.posthogProjectId, apiKey: app.posthogApiKey },
      days,
    ),
    prisma.healthReport.findFirst({
      where: { appId, createdAt: { lt: windowStart } },
      orderBy: { createdAt: "desc" },
      select: { score: true },
    }),
    prisma.healthReport.findMany({
      where: { appId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { score: true, createdAt: true },
    }),
  ]);
  if (dauPoints === null) return null;

  const scoreByDate = new Map<string, number>();
  for (const r of healthReports) {
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
 * day by an external cron hitting POST /api/track. */
export async function runDailyTracking(country = DEFAULT_COUNTRY) {
  const apps = await prisma.app.findMany();
  const summary = { apps: 0, keywordsTracked: 0, competitorsTracked: 0, reviewsSynced: 0, errors: [] as string[] };

  for (const app of apps) {
    try {
      await syncAppMetadata(app.id, country);
      summary.apps += 1;

      try {
        const { synced } = await syncReviews(app.id, country);
        summary.reviewsSynced += synced;
      } catch (e) {
        summary.errors.push(`reviews (${app.name}): ${(e as Error).message}`);
      }

      const keywords = await prisma.keyword.findMany({ where: { appId: app.id } });
      const competitors = await prisma.competitor.findMany({ where: { appId: app.id } });

      for (const keyword of keywords) {
        try {
          const position = await stores.findRank(app.platform, keyword.term, app.storeId, country);
          await prisma.keywordRank.create({ data: { keywordId: keyword.id, position } });
          summary.keywordsTracked += 1;

          for (const competitor of competitors) {
            try {
              await trackCompetitorForKeyword(competitor, keyword.id, keyword.term, country);
              summary.competitorsTracked += 1;
            } catch (e) {
              summary.errors.push(`competitor ${competitor.name}/${keyword.term}: ${(e as Error).message}`);
            }
          }
        } catch (e) {
          summary.errors.push(`keyword ${keyword.term} (${app.name}): ${(e as Error).message}`);
        }
      }
    } catch (e) {
      summary.errors.push(`app ${app.name}: ${(e as Error).message}`);
    }
  }

  return summary;
}
