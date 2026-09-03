import { Hono } from "hono";
import { getProductHealthTrend } from "@/lib/appService";

const productHealthRoutes = new Hono();

productHealthRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  try {
    const trend = await getProductHealthTrend(id);
    return c.json({ trend });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default productHealthRoutes;
