import { NextResponse } from "next/server";
import { runGlobalScan, getLatestGlobalScan } from "@/lib/appService";

type Params = { params: Promise<{ id: string; keywordId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { keywordId } = await params;
  const results = await getLatestGlobalScan(keywordId);
  return NextResponse.json({ results });
}

export async function POST(_req: Request, { params }: Params) {
  const { id, keywordId } = await params;
  try {
    const results = await runGlobalScan(id, keywordId);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
