import { Hono } from "hono";
import * as stores from "@/lib/stores";
import type { StorePlatform } from "@/lib/stores/types";
import { extractKeywordPhrases } from "@/lib/research";

// Fetching each app's full listing (for its title/subtitle) is an extra
// store request per app, so only the top slice gets enriched with keywords
// even on a "deep" search - keeps the standalone keyword-search page useful
// without making every result wait on 50 sequential-ish lookups.
const KEYWORD_ENRICH_LIMIT = 20;

const search = new Hono();

search.get("/", async (c) => {
  const platform = c.req.query("platform") as StorePlatform | null;
  const term = c.req.query("term");
  const country = c.req.query("country") ?? "us";
  const deep = c.req.query("deep") === "1";
  const withKeywords = c.req.query("withKeywords") === "1";

  if (!platform || (platform !== "IOS" && platform !== "ANDROID")) {
    return c.json({ error: "platform must be IOS or ANDROID" }, 400);
  }
  if (!term) {
    return c.json({ error: "term is required" }, 400);
  }

  try {
    const results = await stores.search(platform, term, country, deep ? 50 : 10);

    // The index in a store's search results *is* the app's rank for this
    // term, so surface it - lets standalone keyword lookup double as a live
    // leaderboard, not just an unordered list of apps.
    if (!withKeywords) {
      return c.json({
        results: results.map((hit, i) => ({ ...hit, position: i + 1 })),
      });
    }

    const enriched = await Promise.all(
      results.map(async (hit, i) => {
        if (i >= KEYWORD_ENRICH_LIMIT) return { ...hit, position: i + 1, topKeywords: [] as string[] };
        try {
          const listing = await stores.getListing(platform, hit.storeId, country);
          const topKeywords = listing
            ? extractKeywordPhrases(`${listing.title ?? ""} ${listing.subtitle ?? ""}`, 6)
            : [];
          return { ...hit, position: i + 1, topKeywords };
        } catch {
          return { ...hit, position: i + 1, topKeywords: [] as string[] };
        }
      }),
    );

    return c.json({ results: enriched });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default search;
