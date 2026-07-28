import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLocalizations } from "@/lib/localizationSync";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const rows = await prisma.appLocalization.findMany({
    where: { appId: id },
    orderBy: { locale: "asc" },
  });
  return NextResponse.json({ localizations: rows });
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const results = await syncLocalizations(id);
    const rows = await prisma.appLocalization.findMany({
      where: { appId: id },
      orderBy: { locale: "asc" },
    });
    return NextResponse.json({ results, localizations: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
