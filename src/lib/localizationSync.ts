import { prisma } from "@/lib/prisma";
import { fetchLocalizedListing } from "@/lib/stores/playstore";
import { computeLocaleHealthReport } from "@/lib/localizationAudit";
import { LOCALE_CANDIDATES } from "@/lib/localeCandidates";

const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface LocalizationSyncResult {
  locale: string;
  label: string;
  found: boolean;
  score: number | null;
  titleLocalized: boolean;
  issueCount: number;
}

/** Walks every candidate storefront locale, re-fetches the live listing with
 * that locale's `lang`, and scores it independently of the base (English)
 * health report - see src/lib/localizationAudit.ts for what "score" means
 * here. Android only for now: google-play-scraper's `lang` param makes this
 * a straightforward per-locale re-fetch; the App Store side doesn't have an
 * equivalent path wired up yet. A locale whose fetched title/subtitle/
 * description are all byte-identical to the base English listing is treated
 * as "not actually published" for that locale (rather than stored as a
 * rock-bottom score) since Play just silently serves the default listing
 * for storefronts that were never localized. */
export async function syncLocalizations(appId: string): Promise<LocalizationSyncResult[]> {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  if (app.platform !== "ANDROID") {
    throw new Error("Per-locale localization sync is only supported for Android apps right now");
  }

  const results = await mapWithConcurrency(LOCALE_CANDIDATES, CONCURRENCY, async (candidate) => {
    const listing = await fetchLocalizedListing(app.storeId, candidate.code, candidate.country);
    if (!listing || (!listing.title && !listing.subtitle && !listing.description)) {
      return { candidate, listing: null };
    }
    return { candidate, listing };
  });

  const base = results.find((r) => r.candidate.code === "en")?.listing;
  const baseTitle = base?.title ?? app.title;

  // The literal "translated title" fallback Play serves for an unlocalized
  // storefront isn't necessarily identical to the base English listing's
  // title (it can be the app's raw manifest label, a different default
  // locale, etc.) - so string equality against `en` alone under-detects it.
  // A title that's shared verbatim across several *different* non-English
  // locales is the more reliable tell: real per-locale translations don't
  // coincidentally produce byte-identical text in, say, Japanese and
  // Turkish, so any title repeated 2+ times outside `en` is almost
  // certainly one shared fallback string, not independent translations.
  const nonEnTitleCounts = new Map<string, number>();
  for (const { candidate, listing } of results) {
    if (candidate.code === "en" || !listing?.title) continue;
    nonEnTitleCounts.set(listing.title, (nonEnTitleCounts.get(listing.title) ?? 0) + 1);
  }
  const sharedFallbackTitles = new Set(
    Array.from(nonEnTitleCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([title]) => title),
  );

  const summaries: LocalizationSyncResult[] = [];

  for (const { candidate, listing } of results) {
    if (!listing) {
      summaries.push({
        locale: candidate.code,
        label: candidate.label,
        found: false,
        score: null,
        titleLocalized: false,
        issueCount: 0,
      });
      continue;
    }

    // Non-English locale whose title/subtitle/description are all
    // word-for-word the same as the base listing: Play never actually got a
    // translation for this storefront, it's just inheriting the default. No
    // point scoring/storing that as a "poor" locale - it isn't a locale yet.
    const isBase = candidate.code === "en";
    const identicalToBase =
      !isBase &&
      base &&
      listing.title === base.title &&
      listing.subtitle === base.subtitle &&
      listing.description === base.description;

    if (identicalToBase) {
      summaries.push({
        locale: candidate.code,
        label: candidate.label,
        found: false,
        score: null,
        titleLocalized: false,
        issueCount: 0,
      });
      continue;
    }

    const isBaseLocale = candidate.code === "en" || candidate.code.startsWith("en-");
    const titleLocalized =
      isBaseLocale ||
      (!!listing.title &&
        listing.title.trim().toLowerCase() !== (baseTitle ?? "").trim().toLowerCase() &&
        !(listing.title && sharedFallbackTitles.has(listing.title)));

    const report = computeLocaleHealthReport(app.platform, candidate.code, listing, titleLocalized);

    await prisma.appLocalization.upsert({
      where: { appId_locale: { appId, locale: candidate.code } },
      create: {
        appId,
        locale: candidate.code,
        title: listing.title,
        subtitle: listing.subtitle,
        description: listing.description,
        titleLocalized: report.titleLocalized,
        score: report.score,
        breakdown: report.breakdown as unknown as object,
        issues: report.issues as unknown as object,
      },
      update: {
        title: listing.title,
        subtitle: listing.subtitle,
        description: listing.description,
        titleLocalized: report.titleLocalized,
        score: report.score,
        breakdown: report.breakdown as unknown as object,
        issues: report.issues as unknown as object,
        lastSyncedAt: new Date(),
      },
    });

    summaries.push({
      locale: candidate.code,
      label: candidate.label,
      found: true,
      score: report.score,
      titleLocalized: report.titleLocalized,
      issueCount: report.issues.length,
    });
  }

  // Drop stored rows for locales that no longer resolve to a real
  // translation (e.g. a listing that got reverted to the English default
  // since the last sync).
  const liveLocales = summaries.filter((s) => s.found).map((s) => s.locale);
  await prisma.appLocalization.deleteMany({
    where: { appId, locale: { notIn: liveLocales.length ? liveLocales : ["__none__"] } },
  });

  return summaries;
}
