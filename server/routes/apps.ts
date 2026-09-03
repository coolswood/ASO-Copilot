import { Hono } from "hono";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  apps,
  competitorRanks,
  competitors,
  healthReports,
  keywordRanks,
  keywords,
} from "@/db/schema";
import { createApp, createAppWithProgress } from "@/lib/appService";
import type { StorePlatform } from "@/lib/stores/types";
import { APP_RETURNING_COLUMNS, isUniqueViolation } from "./_lib";
import keywordsRoutes from "./apps.keywords";
import competitorsRoutes from "./apps.competitors";
import healthRoutes from "./apps.health";
import productHealthRoutes from "./apps.product-health";
import localizationsRoutes from "./apps.localizations";
import posthogRoutes from "./apps.posthog";
import researchRoutes from "./apps.research";
import reviewsRoutes from "./apps.reviews";
import aiSuggestionsRoutes from "./apps.ai-suggestions";
import syncRoutes from "./apps.sync";

const appsApp = new Hono();

appsApp.get("/", async (c) => {
  const rows = await db.query.apps.findMany({
    columns: { posthogApiKey: false },
    with: { healthReports: { orderBy: [desc(healthReports.createdAt)], limit: 1 } },
    orderBy: [desc(apps.pinned), desc(apps.createdAt)],
  });

  // Prisma's `include: { _count: { select: { keywords, competitors } } }` -
  // reproduced with two grouped counts and explicit `_count` objects.
  const [keywordCounts, competitorCounts] = await Promise.all([
    db.select({ appId: keywords.appId, n: count() }).from(keywords).groupBy(keywords.appId),
    db.select({ appId: competitors.appId, n: count() }).from(competitors).groupBy(competitors.appId),
  ]);
  const keywordCountByApp = new Map(keywordCounts.map((r) => [r.appId, Number(r.n)]));
  const competitorCountByApp = new Map(competitorCounts.map((r) => [r.appId, Number(r.n)]));

  return c.json({
    apps: rows.map(({ healthReports: latest, ...app }) => ({
      ...app,
      _count: {
        keywords: keywordCountByApp.get(app.id) ?? 0,
        competitors: competitorCountByApp.get(app.id) ?? 0,
      },
      healthReports: latest,
    })),
  });
});

appsApp.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;
  const country = (body.country as string) ?? "us";

  if (!platform || !storeId) {
    return c.json({ error: "platform and storeId are required" }, 400);
  }

  try {
    const app = await createApp(platform, storeId, country);
    return c.json({ app }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return c.json({ error: "This app is already being tracked" }, 409);
    }
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** SSE progress feed for the "watch it happen" add-app flow - converts the
 * createAppWithProgress async generator into a stream of `data: {...}\n\n`
 * frames as each real step completes (raw ReadableStream response, exactly
 * what src/components/AddAppProgress.tsx parses: split on "\n\n", keep lines
 * starting with "data:", JSON.parse the remainder). */
appsApp.post("/stream", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;
  const country = (body.country as string) ?? "us";

  if (!platform || !storeId) {
    return c.json({ error: "platform and storeId are required" }, 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      try {
        for await (const event of createAppWithProgress(platform, storeId, country)) {
          send(event);
        }
      } catch (e) {
        send({
          stage: "error",
          message: isUniqueViolation(e)
            ? "This app is already being tracked"
            : (e as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

appsApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
    columns: { posthogApiKey: false },
    with: {
      keywords: {
        with: { ranks: { orderBy: [desc(keywordRanks.checkedAt)], limit: 30 } },
        orderBy: [desc(keywords.createdAt)],
      },
      competitors: {
        with: { ranks: { orderBy: [desc(competitorRanks.checkedAt)], limit: 30 } },
        orderBy: [desc(competitors.createdAt)],
      },
      healthReports: { orderBy: [desc(healthReports.createdAt)], limit: 1 },
    },
  });

  if (!app) return c.json({ error: "Not found" }, 404);
  return c.json({ app });
});

appsApp.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.pinned !== "boolean") {
    return c.json({ error: "pinned must be a boolean" }, 400);
  }
  const [app] = await db
    .update(apps)
    .set({ pinned: body.pinned })
    .where(eq(apps.id, id))
    .returning(APP_RETURNING_COLUMNS);
  // Prisma's update() throws (500) when the row doesn't exist - keep that.
  if (!app) throw new Error(`App ${id} not found`);
  return c.json({ app });
});

appsApp.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await db.delete(apps).where(eq(apps.id, id)).returning({ id: apps.id });
  // Prisma's delete() throws (500) when the row doesn't exist - keep that.
  if (deleted.length === 0) throw new Error(`App ${id} not found`);
  return c.json({ ok: true });
});

appsApp.route("/:id/keywords", keywordsRoutes);
appsApp.route("/:id/competitors", competitorsRoutes);
appsApp.route("/:id/health", healthRoutes);
appsApp.route("/:id/product-health", productHealthRoutes);
appsApp.route("/:id/localizations", localizationsRoutes);
appsApp.route("/:id/posthog", posthogRoutes);
appsApp.route("/:id/research", researchRoutes);
appsApp.route("/:id/reviews", reviewsRoutes);
appsApp.route("/:id/ai-suggestions", aiSuggestionsRoutes);
appsApp.route("/:id/sync", syncRoutes);

export default appsApp;
