import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeHealth } from "@/lib/appService";

type Params = { params: Promise<{ id: string; keywordId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id, keywordId } = await params;
  await prisma.keyword.delete({ where: { id: keywordId } });
  await recomputeHealth(id);
  return NextResponse.json({ ok: true });
}
