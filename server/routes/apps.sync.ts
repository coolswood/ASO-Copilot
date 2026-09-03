import { Hono } from "hono";
import { syncAppMetadata } from "@/lib/appService";

const syncRoutes = new Hono();

syncRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  try {
    const app = await syncAppMetadata(id);
    return c.json({ app });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default syncRoutes;
