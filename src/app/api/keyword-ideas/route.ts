import { NextRequest, NextResponse } from "next/server";
import type { StorePlatform } from "@/lib/stores/types";
import { discoverKeywordIdeas } from "@/lib/research";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as StorePlatform | null;
  const term = searchParams.get("term")?.trim();
  const country = searchParams.get("country") ?? "us";
  const deep = searchParams.get("deep") === "1";

  if (!platform || (platform !== "IOS" && platform !== "ANDROID")) {
    return NextResponse.json({ error: "platform must be IOS or ANDROID" }, { status: 400 });
  }
  if (!term) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }

  try {
    const data = await discoverKeywordIdeas(platform, term, country, deep);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
