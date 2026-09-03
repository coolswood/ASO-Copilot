import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { healthReports } from "@/db/schema";
import { recomputeHealth } from "@/lib/appService";

const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const refresh = c.req.query("refresh") === "1";

  if (!refresh) {
    const latest = await db.query.healthReports.findFirst({
      where: eq(healthReports.appId, id),
      orderBy: [desc(healthReports.createdAt)],
    });
    if (latest) return c.json({ report: latest });
  }

  const report = await recomputeHealth(id);
  return c.json({ report });
});

export default healthRoutes;
