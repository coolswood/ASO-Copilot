import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, keywordSuggestions } from "@/db/schema";
import * as stores from "@/lib/stores";
import {
  expandCandidates,
  extractSeedTerms,
  keywordOpportunityRank,
  scoreKeywords,
} from "@/lib/research";
import { autoDetectCompetitors } from "@/lib/appService";
import { parseCountryParam } from "@/lib/countryParam";

const MAX_SCORED = 15;

const researchRoutes = new Hono();

researchRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const limit = Number(c.req.query("limit") ?? MAX_SCORED);
  // Storefront the research runs against - autocomplete, volume/difficulty
  // scoring and competitor discovery are all market-specific. Defaults to
  // "us" (the pre-selector behavior) rather than no-filter, because a mixed
  // cross-market candidate list is meaningless for scoring.
  const country = parseCountryParam(c.req.query("country")) ?? "us";

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
    columns: { posthogApiKey: false },
    with: { competitors: true, keywords: true },
  });
  if (!app) return c.json({ error: "Not found" }, 404);

  const trackedTerms = new Set(app.keywords.map((k) => k.term));

  const ownSeeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 8);
  const competitorSeeds = app.competitors.flatMap((competitor) =>
    extractSeedTerms(`${competitor.title ?? ""} ${competitor.subtitle ?? ""}`, 5),
  );
  const uniqueSeeds = Array.from(new Set([...ownSeeds, ...competitorSeeds]));

  // Store autocomplete reflects real user queries, not a heuristic - when
  // available it's the best "similar keyword" signal there is, so it goes
  // in untouched rather than through the local seed-pairing fallback below.
  const autocomplete = Array.from(
    new Set(
      (
        await Promise.all(
          ownSeeds
            .slice(0, 5)
            .map((seed) => stores.autocompleteSuggestions(app.platform, seed, country)),
        )
      ).flat(),
    ),
  );

  const candidates = [...autocomplete, ...expandCandidates(uniqueSeeds, limit * 2)].filter(
    (term) => !trackedTerms.has(term),
  );
  const capped = Array.from(new Set(candidates)).slice(0, Math.min(limit, MAX_SCORED));

  const scored = await scoreKeywords(app.platform, capped, app.storeId, country);
  const ranked = scored.sort((a, b) => keywordOpportunityRank(b) - keywordOpportunityRank(a));

  await Promise.all(
    ranked.map((k) =>
      db
        .insert(keywordSuggestions)
        .values({
          appId: id,
          term: k.term,
          country,
          volume: k.volume,
          difficulty: k.difficulty,
          source: "research",
        })
        // Prisma upsert on the appId_term_country unique key: same row is
        // refreshed per storefront.
        .onConflictDoUpdate({
          target: [keywordSuggestions.appId, keywordSuggestions.term, keywordSuggestions.country],
          set: { volume: k.volume, difficulty: k.difficulty },
        }),
    ),
  );

  // Keyword research and competitor discovery both start from the same
  // seed terms, so run competitor discovery alongside it - most users
  // don't have anyone to compare against yet either.
  const newCompetitors = await autoDetectCompetitors(id, country);

  return c.json({
    suggestions: ranked,
    newCompetitors: newCompetitors.map((competitor) => ({
      id: competitor.id,
      name: competitor.name,
      iconUrl: competitor.iconUrl,
    })),
  });
});

export default researchRoutes;
