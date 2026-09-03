import { Hono } from "hono";
import { findReviewKeywordGaps, getReviewAnalysis, syncReviews } from "@/lib/appService";

const reviewsRoutes = new Hono();

reviewsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const refresh = c.req.query("refresh") === "1";

  try {
    if (refresh) await syncReviews(id);
    const analysis = await getReviewAnalysis(id);
    return c.json({ analysis });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

reviewsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  try {
    const result = await syncReviews(id);
    const analysis = await getReviewAnalysis(id);
    return c.json({ ...result, analysis });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

reviewsRoutes.get("/keyword-gaps", async (c) => {
  const id = c.req.param("id")!;
  try {
    const gaps = await findReviewKeywordGaps(id);
    return c.json({ gaps });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default reviewsRoutes;
