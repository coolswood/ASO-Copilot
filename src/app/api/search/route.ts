import { NextRequest, NextResponse } from "next/server";
import * as stores from "@/lib/stores";
import type { StorePlatform } from "@/lib/stores/types";
import { extractKeywordPhrases } from "@/lib/research";

// Fetching each app's full listing (for its title/subtitle) is an extra
// store request per app, so only the top slice gets enriched with keywords
// even on a "deep" search - keeps the standalone keyword-search page useful
// without making every result wait on 50 sequential-ish lookups.
const KEYWORD_ENRICH_LIMIT = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as StorePlatform | null;
  const term = searchParams.get("term");
  const country = searchParams.get("country") ?? "us";
  const deep = searchParams.get("deep") === "1";
  const withKeywords = searchParams.get("withKeywords") === "1";

  if (!platform || (platform !== "IOS" && platform !== "ANDROID")) {
    return NextResponse.json({ error: "platform must be IOS or ANDROID" }, { status: 400 });
  }
  if (!term) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }

  try {
    const results = await stores.search(platform, term, country, deep ? 50 : 10);

    // The index in a store's search results *is* the app's rank for this
    // term, so surface it - lets standalone keyword lookup double as a live
    // leaderboard, not just an unordered list of apps.
    if (!withKeywords) {
      return NextResponse.json({
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

    return NextResponse.json({ results: enriched });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
