import * as cheerio from "cheerio";
import type { StoreListing, StoreSearchHit, StoreReview } from "./types";

const BASE = "https://itunes.apple.com";

interface ITunesResult {
  trackId: number;
  bundleId: string;
  trackName: string;
  artistName: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  description?: string;
  version?: string;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  currentVersionReleaseDate?: string;
  trackViewUrl?: string;
  languageCodesISO2A?: string[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ASO-tracker/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`iTunes request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function toListing(r: ITunesResult): StoreListing {
  const screenshotUrls = [...(r.screenshotUrls ?? []), ...(r.ipadScreenshotUrls ?? [])];
  return {
    platform: "IOS",
    storeId: r.bundleId,
    name: r.trackName,
    developer: r.artistName ?? null,
    iconUrl: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
    url: r.trackViewUrl ?? null,
    category: r.primaryGenreName ?? null,
    rating: r.averageUserRating ?? null,
    ratingCount: r.userRatingCount ?? null,
    title: r.trackName ?? null,
    subtitle: null,
    description: r.description ?? null,
    screenshotCount: screenshotUrls.length || null,
    screenshotUrls,
    languageCount: r.languageCodesISO2A?.length ?? null,
    version: r.version ?? null,
    lastUpdated: r.currentVersionReleaseDate
      ? new Date(r.currentVersionReleaseDate)
      : null,
  };
}

/** Scrapes the public App Store product page for the subtitle, since the
 * iTunes Search/Lookup API doesn't expose it. Best-effort: returns null if
 * the page structure doesn't match (Apple changes markup periodically). */
export async function fetchSubtitle(trackViewUrl: string): Promise<string | null> {
  try {
    const res = await fetch(trackViewUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ASO-tracker/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const subtitle = $("p.subtitle, h2.product-header__subtitle").first().text().trim();
    return subtitle || null;
  } catch {
    return null;
  }
}

export async function lookupByBundleId(
  bundleId: string,
  country = "us",
): Promise<StoreListing | null> {
  const data = await fetchJson<{ results: ITunesResult[] }>(
    `${BASE}/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${country}`,
  );
  const result = data.results[0];
  if (!result) return null;
  const listing = toListing(result);
  if (result.trackViewUrl) {
    listing.subtitle = await fetchSubtitle(result.trackViewUrl);
  }
  return listing;
}

export async function searchApps(
  term: string,
  country = "us",
  limit = 30,
): Promise<StoreSearchHit[]> {
  const data = await fetchJson<{ results: ITunesResult[] }>(
    `${BASE}/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${limit}`,
  );
  return data.results.map((r) => ({
    storeId: r.bundleId,
    name: r.trackName,
    iconUrl: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
    developer: r.artistName ?? null,
  }));
}

/** Finds the 1-based rank of `bundleId` in App Store search results for `term`.
 * Returns null if the app doesn't appear within the top `maxPositions` (max 200). */
export async function findRank(
  term: string,
  bundleId: string,
  country = "us",
  maxPositions = 200,
): Promise<number | null> {
  const data = await fetchJson<{ results: ITunesResult[] }>(
    `${BASE}/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${Math.min(maxPositions, 200)}`,
  );
  const index = data.results.findIndex((r) => r.bundleId === bundleId);
  return index === -1 ? null : index + 1;
}

/** Apple's (undocumented but long-stable, widely used by ASO tools) search
 * hints endpoint - the same suggestion list the App Store search bar shows
 * as you type. This is real user query data, not a heuristic, so it's the
 * best signal available for "similar keywords". Best-effort: returns []
 * if Apple changes or throttles the endpoint. */
export async function autocompleteSuggestions(term: string, country = "us"): Promise<string[]> {
  try {
    const res = await fetch(
      `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&country=${country}&term=${encodeURIComponent(term)}`,
      {
        method: "POST",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ASO-tracker/1.0)" },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { hints?: { term?: string }[] };
    return (data.hints ?? [])
      .map((h) => h.term?.toLowerCase().trim())
      .filter((t): t is string => Boolean(t));
  } catch {
    return [];
  }
}

interface RssReviewEntry {
  id: { label: string };
  title?: { label: string };
  content?: { label: string };
  author?: { name?: { label: string } };
  "im:rating"?: { label: string };
  "im:version"?: { label: string };
  updated?: { label: string };
}

/** Apple doesn't expose reviews via the Search/Lookup API - this is the
 * public RSS reviews feed the App Store product page itself uses, one page
 * (~50 reviews) of the most recent reviews. The feed is keyed by Apple's
 * numeric trackId, not the bundleId this app is otherwise tracked by, so a
 * lookup is needed first to resolve one to the other. */
export async function fetchReviews(bundleId: string, country = "us"): Promise<StoreReview[]> {
  try {
    const lookup = await fetchJson<{ results: ITunesResult[] }>(
      `${BASE}/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${country}`,
    );
    const trackId = lookup.results[0]?.trackId;
    if (!trackId) return [];

    const data = await fetchJson<{ feed?: { entry?: RssReviewEntry[] } }>(
      `https://itunes.apple.com/${country}/rss/customerreviews/id=${trackId}/sortby=mostrecent/json`,
    );
    const entries = data.feed?.entry ?? [];
    return entries
      .filter((e) => e["im:rating"])
      .map((e) => ({
        externalId: e.id.label,
        rating: e["im:rating"]?.label ? Number(e["im:rating"].label) : null,
        title: e.title?.label ?? null,
        text: e.content?.label ?? null,
        authorName: e.author?.name?.label ?? null,
        version: e["im:version"]?.label ?? null,
        reviewedAt: e.updated?.label ? new Date(e.updated.label) : null,
      }));
  } catch {
    return [];
  }
}

/** Single search call used to derive both a demand proxy (relevant result
 * count) and a competitiveness proxy (average rating count of the top 10
 * relevant results). Apple's search is fuzzy and returns a near-full page of
 * loosely related apps for almost any query, so raw resultCount saturates at
 * roughly the same value regardless of how specific or nonsensical the term
 * is. Filtering to listings whose name actually contains every word of the
 * term turns this into a real relevance signal instead of noise. */
export async function analyzeTerm(
  term: string,
  country = "us",
): Promise<{ resultCount: number; topAuthority: number }> {
  const data = await fetchJson<{ resultCount: number; results: ITunesResult[] }>(
    `${BASE}/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=100`,
  );
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const relevant = data.results.filter((r) => {
    const name = (r.trackName ?? "").toLowerCase();
    return words.every((w) => name.includes(w));
  });
  const top = relevant.slice(0, 10).map((r) => r.userRatingCount ?? 0);
  const topAuthority = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
  return { resultCount: relevant.length, topAuthority };
}
