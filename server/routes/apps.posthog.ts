import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { verifyPostHogCredentials } from "@/lib/posthogIntegration";

const posthogRoutes = new Hono();

posthogRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
    columns: { posthogHost: true, posthogProjectId: true, posthogConnectedAt: true },
  });
  if (!app) return c.json({ error: "Not found" }, 404);
  return c.json({
    connected: app.posthogConnectedAt !== null,
    host: app.posthogHost,
    projectId: app.posthogProjectId,
    connectedAt: app.posthogConnectedAt,
  });
});

posthogRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => ({}));
  const host = ((body.host as string) || "").trim().replace(/\/$/, "");
  const projectId = ((body.projectId as string) || "").trim();
  const apiKey = ((body.apiKey as string) || "").trim();

  if (!host || !projectId || !apiKey) {
    return c.json({ error: "host, projectId, and apiKey are required" }, 400);
  }

  const result = await verifyPostHogCredentials({ host, projectId, apiKey });
  if (!result.ok) {
    return c.json({ error: result.error ?? "Could not verify credentials" }, 400);
  }

  const updated = await db
    .update(apps)
    .set({
      posthogHost: host,
      posthogProjectId: projectId,
      posthogApiKey: apiKey,
      posthogConnectedAt: new Date(),
    })
    .where(eq(apps.id, id))
    .returning({ id: apps.id });
  // Prisma's update() throws (500) when the row doesn't exist - keep that.
  if (updated.length === 0) throw new Error(`App ${id} not found`);

  return c.json({ connected: true, projectName: result.projectName });
});

posthogRoutes.delete("/", async (c) => {
  const id = c.req.param("id")!;
  const updated = await db
    .update(apps)
    .set({
      posthogHost: null,
      posthogProjectId: null,
      posthogApiKey: null,
      posthogConnectedAt: null,
    })
    .where(eq(apps.id, id))
    .returning({ id: apps.id });
  // Prisma's update() throws (500) when the row doesn't exist - keep that.
  if (updated.length === 0) throw new Error(`App ${id} not found`);
  return c.json({ connected: false });
});

export default posthogRoutes;
