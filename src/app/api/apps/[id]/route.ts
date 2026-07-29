import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const app = await prisma.app.findUnique({
    where: { id },
    include: {
      keywords: {
        include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
        orderBy: { createdAt: "desc" },
      },
      competitors: {
        include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
        orderBy: { createdAt: "desc" },
      },
      healthReports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ app });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.pinned !== "boolean") {
    return NextResponse.json({ error: "pinned must be a boolean" }, { status: 400 });
  }
  const app = await prisma.app.update({ where: { id }, data: { pinned: body.pinned } });
  return NextResponse.json({ app });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.app.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
