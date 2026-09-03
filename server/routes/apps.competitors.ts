import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { competitorRanks, competitors } from "@/db/schema";
import { addCompetitor } from "@/lib/appService";
import type { StorePlatform } from "@/lib/stores/types";
import { isUniqueViolation } from "./_lib";

const competitorsRoutes = new Hono();

competitorsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const rows = await db.query.competitors.findMany({
    where: eq(competitors.appId, id),
    with: { ranks: { orderBy: [desc(competitorRanks.checkedAt)], limit: 30 } },
    orderBy: [desc(competitors.createdAt)],
  });
  return c.json({ competitors: rows });
});

competitorsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;

  if (!platform || !storeId) {
    return c.json({ error: "platform and storeId are required" }, 400);
  }

  try {
    const competitor = await addCompetitor(id, platform, storeId);
    return c.json({ competitor }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "Already tracking this competitor" }, 409);
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
