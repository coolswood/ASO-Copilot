import { NextRequest, NextResponse } from "next/server";
import { runDailyTracking } from "@/lib/appService";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("token");
  return header === `Bearer ${secret}` || queryToken === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runDailyTracking();
  return NextResponse.json({ summary });
}

// Allow triggering from cron providers that only send GET requests.
export async function GET(req: NextRequest) {
  return POST(req);
}
