import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { keywordRanks, keywords } from "@/db/schema";
import {
  addKeyword,
  autoDetectKeywords,
  getLatestGlobalScan,
  recomputeHealth,
  runGlobalScan,
} from "@/lib/appService";
import { parseCountryParam, resolveCountry } from "@/lib/countryParam";
import { isUniqueViolation } from "./_lib";

const keywordsRoutes = new Hono();

keywordsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  // Optional storefront filter - absent = all countries mixed.
  const country = parseCountryParam(c.req.query("country"));
  const rows = await db.query.keywords.findMany({
    where: country
      ? and(eq(keywords.appId, id), eq(keywords.country, country))
      : eq(keywords.appId, id),
    with: { ranks: { orderBy: [desc(keywordRanks.checkedAt)], limit: 30 } },
    orderBy: [desc(keywords.createdAt)],
  });
  return c.json({ keywords: rows });
});

keywordsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => ({}));
  const term = (body.term as string)?.trim();
  if (!term) return c.json({ error: "term is required" }, 400);
  // Storefront to track the term in (lowercase ISO 3166-1 alpha-2). Anything
  // that isn't a 2-letter code silently falls back to the default ("us") so
  // pre-country clients keep working unchanged.
  const country = resolveCountry(typeof body.country === "string" ? body.country : null, "us");

  try {
    const keyword = await addKeyword(id, term, country);
    await recomputeHealth(id);
    return c.json({ keyword }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "Already tracking this keyword for this country" }, 409);
    }
    return c.json({ error: (e as Error).message }, 502);
  }
});

keywordsRoutes.post("/auto-detect", async (c) => {
  const id = c.req.param("id")!;
  // Same country contract as POST / - the detected keywords are tracked in
  // the given storefront (defaults to "us"), matching the MCP counterpart.
  const body = await c.req.json().catch(() => ({}));
  const country = resolveCountry(typeof body.country === "string" ? body.country : null, "us");
  const added = await autoDetectKeywords(id, country);
  return c.json({ added });
});

keywordsRoutes.delete("/:keywordId", async (c) => {
  const { id, keywordId } = { id: c.req.param("id")!, keywordId: c.req.param("keywordId")! };
  const deleted = await db
    .delete(keywords)
    .where(eq(keywords.id, keywordId))
    .returning({ id: keywords.id });
  // Prisma's delete() throws (500) when the row doesn't exist - keep that.
  if (deleted.length === 0) throw new Error(`Keyword ${keywordId} not found`);
  await recomputeHealth(id);
  return c.json({ ok: true });
});

keywordsRoutes.get("/:keywordId/global-scan", async (c) => {
  const keywordId = c.req.param("keywordId")!;
  const results = await getLatestGlobalScan(keywordId);
  return c.json({ results });
});

keywordsRoutes.post("/:keywordId/global-scan", async (c) => {
  const id = c.req.param("id")!;
  const keywordId = c.req.param("keywordId")!;
  try {
    const results = await runGlobalScan(id, keywordId);
    return c.json({ results });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default keywordsRoutes;
