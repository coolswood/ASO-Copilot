import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompetitor } from "@/lib/appService";
import type { StorePlatform } from "@/lib/stores/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const competitors = await prisma.competitor.findMany({
    where: { appId: id },
    include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ competitors });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;

  if (!platform || !storeId) {
    return NextResponse.json({ error: "platform and storeId are required" }, { status: 400 });
  }

  try {
    const competitor = await addCompetitor(id, platform, storeId);
    return NextResponse.json({ competitor }, { status: 201 });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Already tracking this competitor" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
