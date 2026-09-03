import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { competitorRanks, competitors, keywords } from "@/db/schema";
import { addCompetitor } from "@/lib/appService";
import { parseCountryParam, resolveCountry } from "@/lib/countryParam";
import type { StorePlatform } from "@/lib/stores/types";
import { isUniqueViolation } from "./_lib";

const competitorsRoutes = new Hono();

competitorsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  // Optional storefront filter - absent = all countries mixed.
  const country = parseCountryParam(c.req.query("country"));
  const rows = await db.query.competitors.findMany({
    where: country
      ? and(eq(competitors.appId, id), eq(competitors.country, country))
      : eq(competitors.appId, id),
    with: { ranks: { orderBy: [desc(competitorRanks.checkedAt)], limit: 30 } },
    orderBy: [desc(competitors.createdAt)],
  });
  if (!country) return c.json({ competitors: rows });

  // Each competitor rank belongs to exactly one keyword, whose country
  // decides its market - trim ranks to this storefront's keywords.
  const keywordIds = new Set(
    (
      await db.query.keywords.findMany({
        where: eq(keywords.appId, id),
        columns: { id: true, country: true },
      })
    )
      .filter((k) => k.country === country)
      .map((k) => k.id),
  );
  return c.json({
    competitors: rows.map((competitor) => ({
      ...competitor,
      ranks: competitor.ranks.filter((rank) => keywordIds.has(rank.keywordId)),
    })),
  });
});

competitorsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;
  // Storefront the competitor is added for - defaults to "us", like the
  // keyword add endpoint.
  const country = resolveCountry(typeof body.country === "string" ? body.country : null, "us");

  if (!platform || !storeId) {
    return c.json({ error: "platform and storeId are required" }, 400);
  }

  try {
    const competitor = await addCompetitor(id, platform, storeId, country);
    return c.json({ competitor }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "Already tracking this competitor for this country" }, 409);
    }
    return c.json({ error: (e as Error).message }, 502);
  }
});

competitorsRoutes.delete("/:competitorId", async (c) => {
  const competitorId = c.req.param("competitorId")!;
  const deleted = await db
    .delete(competitors)
    .where(eq(competitors.id, competitorId))
    .returning({ id: competitors.id });
  // Prisma's delete() throws (500) when the row doesn't exist - keep that.
  if (deleted.length === 0) throw new Error(`Competitor ${competitorId} not found`);
  return c.json({ ok: true });
});

export default competitorsRoutes;
