import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeHealth } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  if (!refresh) {
    const latest = await prisma.healthReport.findFirst({
      where: { appId: id },
      orderBy: { createdAt: "desc" },
    });
    if (latest) return NextResponse.json({ report: latest });
  }

  const report = await recomputeHealth(id);
  return NextResponse.json({ report });
}
