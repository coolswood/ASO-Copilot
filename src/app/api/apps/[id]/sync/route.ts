import { NextResponse } from "next/server";
import { syncAppMetadata } from "@/lib/appService";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const app = await syncAppMetadata(id);
    return NextResponse.json({ app });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
