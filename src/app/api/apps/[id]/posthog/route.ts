import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPostHogCredentials } from "@/lib/posthogIntegration";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const app = await prisma.app.findUnique({
    where: { id },
    select: { posthogHost: true, posthogProjectId: true, posthogConnectedAt: true },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    connected: app.posthogConnectedAt !== null,
    host: app.posthogHost,
    projectId: app.posthogProjectId,
    connectedAt: app.posthogConnectedAt,
  });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const host = ((body.host as string) || "").trim().replace(/\/$/, "");
  const projectId = ((body.projectId as string) || "").trim();
  const apiKey = ((body.apiKey as string) || "").trim();

  if (!host || !projectId || !apiKey) {
    return NextResponse.json({ error: "host, projectId, and apiKey are required" }, { status: 400 });
  }

  const result = await verifyPostHogCredentials({ host, projectId, apiKey });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not verify credentials" }, { status: 400 });
  }

  await prisma.app.update({
    where: { id },
    data: {
      posthogHost: host,
      posthogProjectId: projectId,
      posthogApiKey: apiKey,
      posthogConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ connected: true, projectName: result.projectName });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.app.update({
    where: { id },
    data: {
      posthogHost: null,
      posthogProjectId: null,
      posthogApiKey: null,
      posthogConnectedAt: null,
    },
  });
  return NextResponse.json({ connected: false });
}
