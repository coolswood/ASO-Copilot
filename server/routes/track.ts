import { Hono } from "hono";
import type { Context } from "hono";
import { runDailyTracking } from "@/lib/appService";

const track = new Hono();

function isAuthorized(c: Context): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = c.req.header("authorization");
  const queryToken = c.req.query("token");
  return header === `Bearer ${secret}` || queryToken === secret;
}

async function handleTrack(c: Context) {
  if (!isAuthorized(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const summary = await runDailyTracking();
  return c.json({ summary });
}

track.post("/", handleTrack);
// Allow triggering from cron providers that only send GET requests.
track.get("/", handleTrack);

export default track;
