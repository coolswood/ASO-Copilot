import { NextResponse } from "next/server";
import { findReviewKeywordGaps } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const gaps = await findReviewKeywordGaps(id);
    return NextResponse.json({ gaps });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
