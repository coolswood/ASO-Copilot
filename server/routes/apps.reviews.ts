import { Hono } from "hono";
import type { Context } from "hono";
import { findReviewKeywordGaps, getReviewAnalysis, syncReviews } from "@/lib/appService";
import { parseCountryParam } from "@/lib/countryParam";

const reviewsRoutes = new Hono();

/** Country contract for the reviews endpoints: an explicit ?country= (or body
 * country on POST) scopes the analysis - and the sync it may trigger - to
 * that storefront's reviews. Absent/invalid = aggregate across all synced
 * countries, the pre-selector behavior. */
function countryFilter(c: Context, bodyCountry?: unknown): string | undefined {
  const raw = typeof bodyCountry === "string" ? bodyCountry : c.req.query("country");
  return parseCountryParam(raw) ?? undefined;
}

reviewsRoutes.get("/", async (c) => {
  const id = c.req.param("id")!;
  const refresh = c.req.query("refresh") === "1";
  const country = countryFilter(c);

  try {
    if (refresh) await syncReviews(id, country);
    const analysis = await getReviewAnalysis(id, country);
    return c.json({ analysis });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

reviewsRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => ({}));
  const country = countryFilter(c, body.country);

  try {
    const result = await syncReviews(id, country);
    const analysis = await getReviewAnalysis(id, country);
    return c.json({ ...result, analysis });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

reviewsRoutes.get("/keyword-gaps", async (c) => {
  const id = c.req.param("id")!;
  const country = countryFilter(c);
  try {
    const gaps = await findReviewKeywordGaps(id, country);
    return c.json({ gaps });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default reviewsRoutes;
