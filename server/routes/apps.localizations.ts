import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appLocalizations } from "@/db/schema";
import { syncLocalizations } from "@/lib/localizationSync";

const localizationsRoutes = new Hono();

localizationsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const rows = await db.query.appLocalizations.findMany({
    where: eq(appLocalizations.appId, id),
    orderBy: [asc(appLocalizations.locale)],
  });
  return c.json({ localizations: rows });
});

localizationsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  try {
    const results = await syncLocalizations(id);
    const rows = await db.query.appLocalizations.findMany({
      where: eq(appLocalizations.appId, id),
      orderBy: [asc(appLocalizations.locale)],
    });
    return c.json({ results, localizations: rows });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default localizationsRoutes;
