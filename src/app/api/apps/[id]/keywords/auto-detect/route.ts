import { NextResponse } from "next/server";
import { autoDetectKeywords } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const added = await autoDetectKeywords(id);
  return NextResponse.json({ added });
}
