import { Hono } from "hono";
import { syncAppMetadata } from "@/lib/appService";
import { parseCountryParam } from "@/lib/countryParam";

const syncRoutes = new Hono();

syncRoutes.post("/", async (c) => {
  const id = c.req.param("id")!;
  // Storefront to re-fetch the listing from (body or query param). Absent/
  // invalid = the app's own home country, resolved inside appService.
  const body = await c.req.json().catch(() => ({}));
  const country = parseCountryParam(
    typeof body.country === "string" ? body.country : c.req.query("country"),
  );
  try {
    const app = await syncAppMetadata(id, country ?? undefined);
    return c.json({ app });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default syncRoutes;
