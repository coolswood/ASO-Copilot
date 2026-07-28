import { NextRequest, NextResponse } from "next/server";
import { getReviewAnalysis, syncReviews } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    if (refresh) await syncReviews(id);
    const analysis = await getReviewAnalysis(id);
    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const result = await syncReviews(id);
    const analysis = await getReviewAnalysis(id);
    return NextResponse.json({ ...result, analysis });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
