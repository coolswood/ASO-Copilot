import { Hono } from "hono";
import type { StorePlatform } from "@/lib/stores/types";
import { discoverKeywordIdeas } from "@/lib/research";

const keywordIdeas = new Hono();

keywordIdeas.get("/", async (c) => {
  const platform = c.req.query("platform") as StorePlatform | null;
  const term = c.req.query("term")?.trim();
  const country = c.req.query("country") ?? "us";
  const deep = c.req.query("deep") === "1";

  if (!platform || (platform !== "IOS" && platform !== "ANDROID")) {
    return c.json({ error: "platform must be IOS or ANDROID" }, 400);
  }
  if (!term) {
    return c.json({ error: "term is required" }, 400);
  }

  try {
    const data = await discoverKeywordIdeas(platform, term, country, deep);
    return c.json(data);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

export default keywordIdeas;
