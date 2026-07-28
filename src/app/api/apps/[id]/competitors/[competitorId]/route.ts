import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; competitorId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { competitorId } = await params;
  await prisma.competitor.delete({ where: { id: competitorId } });
  return NextResponse.json({ ok: true });
}
