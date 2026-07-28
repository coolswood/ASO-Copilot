import { NextResponse } from "next/server";
import { getProductHealthTrend } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const trend = await getProductHealthTrend(id);
    return NextResponse.json({ trend });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
