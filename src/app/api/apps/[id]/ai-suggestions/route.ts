import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIConfigError, generateCopySuggestions, getSavedCopySuggestions, saveCopySuggestions } from "@/lib/ai";
import { AI_LOCALES } from "@/lib/aiLocales";
import { DESCRIPTION_IDEAL_LEN, SUBTITLE_RANGE, TITLE_MAX } from "@/lib/health";

type Params = { params: Promise<{ id: string }> };

function resolveLocale(code: string | null) {
  return AI_LOCALES.find((l) => l.code === (code ?? "en"));
}

/** Reads whatever's already saved for a locale - written either by the
 * OpenRouter POST below or by an MCP client's save_copy_suggestions call (no
 * key needed on that path). Lets the panel show prior results on load
 * without requiring OPENROUTER_API_KEY just to view them. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const locale = resolveLocale(new URL(req.url).searchParams.get("locale"));
  if (!locale) return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });

  const saved = await getSavedCopySuggestions(id, locale.code);
  return NextResponse.json({ suggestions: saved?.suggestions ?? null, source: saved?.source ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const localeCode = typeof body.locale === "string" ? body.locale : "en";
  const locale = AI_LOCALES.find((l) => l.code === localeCode);
  if (!locale) {
    return NextResponse.json({ error: `Unsupported locale "${localeCode}"` }, { status: 400 });
  }

  const app = await prisma.app.findUnique({
    where: { id },
    include: { keywords: { select: { term: true } } },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const suggestions = await generateCopySuggestions({
      platform: app.platform,
      title: app.title,
      subtitle: app.subtitle,
      description: app.description,
      keywords: app.keywords.map((k) => k.term),
      locale,
      limits: {
        title: TITLE_MAX[app.platform],
        subtitle: SUBTITLE_RANGE[app.platform],
        description: DESCRIPTION_IDEAL_LEN[app.platform],
      },
    });
    await saveCopySuggestions(id, locale.code, suggestions, "openrouter");
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof AIConfigError) {
      return NextResponse.json({ error: e.message }, { status: 501 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
