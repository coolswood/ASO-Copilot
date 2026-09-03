import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addKeyword, recomputeHealth } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const keywords = await prisma.keyword.findMany({
    where: { appId: id },
    include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keywords });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const term = (body.term as string)?.trim();
  if (!term) return NextResponse.json({ error: "term is required" }, { status: 400 });
  // Storefront to track the term in (lowercase ISO 3166-1 alpha-2). Anything
  // that isn't a 2-letter code silently falls back to the default ("us") so
  // pre-country clients keep working unchanged.
  const rawCountry = typeof body.country === "string" ? body.country.trim().toLowerCase() : "";
  const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "us";

  try {
    const keyword = await addKeyword(id, term, country);
    await recomputeHealth(id);
    return NextResponse.json({ keyword }, { status: 201 });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Already tracking this keyword for this country" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
