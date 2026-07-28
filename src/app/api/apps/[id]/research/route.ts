import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as stores from "@/lib/stores";
import { extractSeedTerms, expandCandidates, scoreKeywords, keywordOpportunityRank } from "@/lib/research";
import { autoDetectCompetitors } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

const MAX_SCORED = 15;

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? MAX_SCORED);

  const app = await prisma.app.findUnique({
    where: { id },
    include: { competitors: true, keywords: true },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trackedTerms = new Set(app.keywords.map((k) => k.term));

  const ownSeeds = extractSeedTerms(`${app.title ?? ""} ${app.subtitle ?? ""}`, 8);
  const competitorSeeds = app.competitors.flatMap((c) =>
    extractSeedTerms(`${c.title ?? ""} ${c.subtitle ?? ""}`, 5),
  );
  const uniqueSeeds = Array.from(new Set([...ownSeeds, ...competitorSeeds]));

  // Store autocomplete reflects real user queries, not a heuristic - when
  // available it's the best "similar keyword" signal there is, so it goes
  // in untouched rather than through the local seed-pairing fallback below.
  const autocomplete = Array.from(
    new Set(
      (await Promise.all(ownSeeds.slice(0, 5).map((s) => stores.autocompleteSuggestions(app.platform, s)))).flat(),
    ),
  );

  const candidates = [...autocomplete, ...expandCandidates(uniqueSeeds, limit * 2)].filter(
    (term) => !trackedTerms.has(term),
  );
  const capped = Array.from(new Set(candidates)).slice(0, Math.min(limit, MAX_SCORED));

  const scored = await scoreKeywords(app.platform, capped, app.storeId);
  const ranked = scored.sort((a, b) => keywordOpportunityRank(b) - keywordOpportunityRank(a));

  await Promise.all(
    ranked.map((k) =>
      prisma.keywordSuggestion.upsert({
        where: { appId_term: { appId: id, term: k.term } },
        create: { appId: id, term: k.term, volume: k.volume, difficulty: k.difficulty, source: "research" },
        update: { volume: k.volume, difficulty: k.difficulty },
      }),
    ),
  );

  // Keyword research and competitor discovery both start from the same
  // seed terms, so run competitor discovery alongside it - most users
  // don't have anyone to compare against yet either.
  const newCompetitors = await autoDetectCompetitors(id);

  return NextResponse.json({
    suggestions: ranked,
    newCompetitors: newCompetitors.map((c) => ({ id: c.id, name: c.name, iconUrl: c.iconUrl })),
  });
}
