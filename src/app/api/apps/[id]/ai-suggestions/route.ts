import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AIConfigError,
  deleteCopySuggestions,
  generateCopySuggestions,
  getSavedCopySuggestions,
  saveCopySuggestions,
} from "@/lib/ai";
import { AI_LOCALES } from "@/lib/aiLocales";
import { DESCRIPTION_IDEAL_LEN, SUBTITLE_RANGE, TITLE_MAX } from "@/lib/health";
import { discoverLocaleKeywords } from "@/lib/research";

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

  // Base English variants have nothing to "discover" beyond the already-
  // English tracked keywords; every other locale gets a live autocomplete
  // pass seeded with real translated copy for that storefront (falling back
  // to the English source if this locale hasn't been synced yet - still
  // useful, just less precise, per discoverLocaleKeywords' own doc comment).
  const isBaseEnglish = locale.code === "en" || locale.code.startsWith("en-");
  let discoveredKeywords: string[] = [];
  if (!isBaseEnglish) {
    const localization = await prisma.appLocalization.findUnique({
      where: { appId_locale: { appId: id, locale: locale.code } },
    });
    // Title/subtitle only, not the full description - those two fields are
    // already curated to be keyword-dense, whereas the description is
    // mostly narrative prose whose longest words tend to be generic adverbs
    // rather than product nouns (see ADVERB_SUFFIXES in research.ts).
    const seedText = [localization?.title ?? app.title, localization?.subtitle ?? app.subtitle]
      .filter(Boolean)
      .join(" ");
    discoveredKeywords = await discoverLocaleKeywords(app.platform, seedText, locale.country, locale.code).catch(
      () => [],
    );
  }

  try {
    const suggestions = await generateCopySuggestions({
      platform: app.platform,
      title: app.title,
      subtitle: app.subtitle,
      description: app.description,
      keywords: app.keywords.map((k) => k.term),
      discoveredKeywords,
      locale,
      limits: {
        title: TITLE_MAX[app.platform],
        subtitle: SUBTITLE_RANGE[app.platform],
        description: DESCRIPTION_IDEAL_LEN[app.platform],
      },
    });
    await saveCopySuggestions(id, locale.code, suggestions, "openrouter");
    return NextResponse.json({ suggestions, discoveredKeywords });
  } catch (e) {
    if (e instanceof AIConfigError) {
      return NextResponse.json({ error: e.message }, { status: 501 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Dismisses a saved suggestion for one locale - e.g. once you've copied it
 * into Play Console/App Store Connect and don't need it cluttering the
 * panel anymore. Purely a delete of the saved row; doesn't touch the live
 * store listing. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const locale = resolveLocale(new URL(req.url).searchParams.get("locale"));
  if (!locale) return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });

  await deleteCopySuggestions(id, locale.code);
  return NextResponse.json({ ok: true });
}
