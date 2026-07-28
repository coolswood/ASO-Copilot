import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApp } from "@/lib/appService";
import type { StorePlatform } from "@/lib/stores/types";

export async function GET() {
  const apps = await prisma.app.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { keywords: true, competitors: true } },
      healthReports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json({ apps });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;
  const country = (body.country as string) ?? "us";

  if (!platform || !storeId) {
    return NextResponse.json({ error: "platform and storeId are required" }, { status: 400 });
  }

  try {
    const app = await createApp(platform, storeId, country);
    return NextResponse.json({ app }, { status: 201 });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "This app is already being tracked" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
