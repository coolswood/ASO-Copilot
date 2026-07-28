import type { StorePlatform } from "./stores/types";

export interface HealthMetadataInput {
  platform: StorePlatform;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  screenshotCount: number | null;
  rating: number | null;
  ratingCount: number | null;
  lastUpdated: Date | null;
  languageCount: number | null;
  keywordTerms: string[];
}

export interface HealthBreakdownItem {
  key: string;
  label: string;
  score: number;
  max: number;
  message: string;
}

export interface HealthSuggestion {
  title: string;
  body: string;
  kind: "info" | "warning" | "critical";
}

export interface HealthReportResult {
  score: number;
  breakdown: HealthBreakdownItem[];
  suggestions: HealthSuggestion[];
}

// Both stores cap the app title at 30 characters (Google Play cut this down
// from 50 in 2019, matching Apple's App Store limit). Exported so the AI
// copy-suggestion feature (src/lib/ai.ts) targets the exact same limits this
// scoring is based on, rather than a second hardcoded copy drifting from it.
export const TITLE_MAX = { IOS: 30, ANDROID: 30 } as const;
export const SUBTITLE_RANGE = { IOS: [20, 30], ANDROID: [50, 80] } as const;
const IDEAL_SCREENSHOTS = { IOS: 8, ANDROID: 6 } as const;
export const DESCRIPTION_IDEAL_LEN = { IOS: 1500, ANDROID: 1500 } as const;

function scoreTitle(platform: StorePlatform, title: string | null): HealthBreakdownItem {
  const max = 20;
  const len = title?.trim().length ?? 0;
  const cap = TITLE_MAX[platform];
  const wordCount = title ? new Set(title.toLowerCase().split(/\s+/).filter(Boolean)).size : 0;

  if (len === 0) {
    return { key: "title", label: "Title", score: 0, max, message: "No title set." };
  }
  const lengthRatio = Math.min(len / cap, 1);
  let score = Math.round(lengthRatio * (max - 6));
  if (wordCount >= 3) score += 6;
  score = Math.min(score, max);

  let message: string;
  if (lengthRatio < 0.5) message = "Too short, add keywords.";
  else if (wordCount < 3) message = "Add more distinct keywords to the title.";
  else message = "Good length and keyword coverage.";

  return { key: "title", label: "Title", score, max, message };
}

function scoreSubtitle(
  platform: StorePlatform,
  subtitle: string | null,
): HealthBreakdownItem {
  const max = 15;
  const [min, ideal] = SUBTITLE_RANGE[platform];
  const len = subtitle?.trim().length ?? 0;

  if (len === 0) {
    return {
      key: "subtitle",
      label: "Subtitle",
      score: 0,
      max,
      message: "No subtitle set.",
    };
  }
  const ratio = Math.min(len / ideal, 1);
  const score = Math.round(ratio * max);
  const message =
    len < min
      ? `Too short, aim for ${min}-${ideal} characters.`
      : "Good length, uses available space.";

  return { key: "subtitle", label: "Subtitle", score, max, message };
}

function scoreScreenshots(
  platform: StorePlatform,
  count: number | null,
): HealthBreakdownItem {
  const max = 20;
  const ideal = IDEAL_SCREENSHOTS[platform];
  const n = count ?? 0;
  const ratio = Math.min(n / ideal, 1);
  const score = Math.round(ratio * max);
  const message =
    n === 0
      ? "No screenshots found."
      : ratio < 1
        ? `Only ${n} screenshot${n === 1 ? "" : "s"}, add more to fill the gallery.`
        : "Full gallery usage.";

  return { key: "screenshots", label: "Screenshots", score, max, message };
}

function scoreDescription(
  platform: StorePlatform,
  description: string | null,
): HealthBreakdownItem {
  const max = 10;
  const text = description?.trim() ?? "";
  if (text.length === 0) {
    return {
      key: "description",
      label: "Description",
      score: 0,
      max,
      message: "No description set.",
    };
  }
  const ideal = DESCRIPTION_IDEAL_LEN[platform];
  const lengthRatio = Math.min(text.length / ideal, 1);
  const hasStructure = /\n/.test(text) || /[•\-*✓]/.test(text);

  let score = Math.round(lengthRatio * (max - 3));
  if (hasStructure) score += 3;
  score = Math.min(score, max);

  const message =
    lengthRatio < 0.4
      ? "Too short, expand with more keyword-rich content."
      : !hasStructure
        ? "Well-written but hard to scan, add line breaks or bullets."
        : "Well-structured and easy to read.";

  return { key: "description", label: "Description", score, max, message };
}

function normalizeForMatch(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ")} `;
}

function scoreKeywordCoverage(
  keywordTerms: string[],
  title: string | null,
  subtitle: string | null,
  description: string | null,
): HealthBreakdownItem {
  const max = 15;
  const key = "keywordCoverage";
  const label = "Keyword Coverage";

  if (keywordTerms.length === 0) {
    return {
      key,
      label,
      score: 0,
      max,
      message: "No tracked keywords yet, nothing to check coverage against.",
    };
  }

  const haystack = normalizeForMatch(`${title ?? ""} ${subtitle ?? ""} ${description ?? ""}`);
  const found = keywordTerms.filter((term) => haystack.includes(` ${term.toLowerCase()} `));
  const ratio = found.length / keywordTerms.length;
  const score = Math.round(ratio * max);

  const missing = keywordTerms.length - found.length;
  const message =
    missing === 0
      ? "Every tracked keyword appears in your metadata."
      : `${missing} of ${keywordTerms.length} tracked keyword${missing === 1 ? "" : "s"} missing from title/subtitle/description.`;

  return { key, label, score, max, message };
}

function scoreRatings(rating: number | null, ratingCount: number | null): HealthBreakdownItem {
  const max = 10;
  const count = ratingCount ?? 0;
  const avg = rating ?? 0;

  if (count === 0) {
    return {
      key: "ratings",
      label: "Ratings",
      score: 0,
      max,
      message: "No ratings yet.",
    };
  }
  const volumeScore = Math.min(Math.log10(count + 1) / Math.log10(10000), 1) * 6;
  const qualityScore = Math.min(avg / 5, 1) * 4;
  const score = Math.round(volumeScore + qualityScore);
  const message =
    score >= 8 ? "Solid authority." : score >= 4 ? "Building authority." : "Low authority, needs more reviews.";

  return { key: "ratings", label: "Ratings", score, max, message };
}

function scoreFreshness(lastUpdated: Date | null): HealthBreakdownItem {
  const max = 10;
  if (!lastUpdated) {
    return {
      key: "freshness",
      label: "Freshness",
      score: 0,
      max,
      message: "No update date found.",
    };
  }
  const days = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  let score: number;
  let message: string;
  if (days <= 30) {
    score = 10;
    message = "Actively maintained.";
  } else if (days <= 90) {
    score = 7;
    message = "Updated recently.";
  } else if (days <= 180) {
    score = 4;
    message = "Getting stale, consider shipping an update.";
  } else {
    score = 0;
    message = "Stale, hasn't been updated in a while.";
  }
  return { key: "freshness", label: "Freshness", score, max, message };
}

export interface CompetitorAuthorityInput {
  name: string;
  ratingCount: number | null;
}

function buildSuggestions(
  breakdown: HealthBreakdownItem[],
  metadata: HealthMetadataInput,
  competitors: CompetitorAuthorityInput[],
): HealthSuggestion[] {
  const suggestions: HealthSuggestion[] = [];
  const byKey = Object.fromEntries(breakdown.map((b) => [b.key, b]));

  const title = byKey.title;
  const titleLen = metadata.title?.trim().length ?? 0;
  const titleCap = TITLE_MAX[metadata.platform];
  if (title && title.score < title.max && titleCap - titleLen >= 10) {
    suggestions.push({
      title: "Title Underfill",
      body: `Your title uses ${titleLen}/${titleCap} characters. Pack in another high-volume keyword before someone else claims that space.`,
      kind: "warning",
    });
  }

  const keywordCoverage = byKey.keywordCoverage;
  if (keywordCoverage && metadata.keywordTerms.length > 0 && keywordCoverage.score < keywordCoverage.max) {
    const haystack = normalizeForMatch(
      `${metadata.title ?? ""} ${metadata.subtitle ?? ""} ${metadata.description ?? ""}`,
    );
    const missing = metadata.keywordTerms.filter((t) => !haystack.includes(` ${t.toLowerCase()} `));
    if (missing.length > 0) {
      suggestions.push({
        title: "Keyword Gaps",
        body: `You're tracking "${missing.slice(0, 5).join('", "')}" but they don't appear anywhere in your title, subtitle, or description. Work the highest-value ones in — rank tracking without metadata coverage is wasted effort.`,
        kind: "warning",
      });
    }
  }

  const screenshots = byKey.screenshots;
  if (screenshots && screenshots.score < screenshots.max * 0.6) {
    suggestions.push({
      title: "Thin Gallery",
      body: "Your screenshot gallery is underused. Each additional slot is free real estate to sell the app before the fold ends.",
      kind: "warning",
    });
  }

  const freshness = byKey.freshness;
  if (freshness && freshness.score <= 4) {
    suggestions.push({
      title: "Update Stale",
      body: "Store algorithms favor recently updated apps. Ship even a minor release to reset your freshness signal.",
      kind: "critical",
    });
  }

  const ratings = byKey.ratings;
  if (ratings && ratings.score <= 4) {
    suggestions.push({
      title: "Thin Review Base",
      body: "Low review volume caps how much ranking authority you can earn. Consider an in-app review prompt after a positive moment.",
      kind: "info",
    });
  }

  if (metadata.languageCount !== null && metadata.languageCount <= 3) {
    suggestions.push({
      title: "Localization Gap",
      body: `Your listing is available in only ${metadata.languageCount} language${metadata.languageCount === 1 ? "" : "s"}. Localizing your title, subtitle, and screenshots into a few more markets (e.g. Spanish, Portuguese, German, Japanese) is one of the highest-leverage ASO moves — it unlocks organic search in those stores' local-language rankings, not just translated text.`,
      kind: "info",
    });
  }

  const unicorn = competitors
    .filter((c) => (c.ratingCount ?? 0) > 50000)
    .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))[0];
  if (unicorn) {
    suggestions.push({
      title: "Unicorn Anomaly",
      body: `${unicorn.name} likely ranks high due to brand fame, not ASO. Copying their metadata strategy is risky for smaller apps — study mid-sized competitors instead.`,
      kind: "info",
    });
  }

  return suggestions;
}

export function computeHealthReport(
  metadata: HealthMetadataInput,
  competitors: CompetitorAuthorityInput[] = [],
): HealthReportResult {
  const breakdown = [
    scoreTitle(metadata.platform, metadata.title),
    scoreSubtitle(metadata.platform, metadata.subtitle),
    scoreScreenshots(metadata.platform, metadata.screenshotCount),
    scoreDescription(metadata.platform, metadata.description),
    scoreKeywordCoverage(metadata.keywordTerms, metadata.title, metadata.subtitle, metadata.description),
    scoreRatings(metadata.rating, metadata.ratingCount),
    scoreFreshness(metadata.lastUpdated),
  ];

  const score = breakdown.reduce((sum, b) => sum + b.score, 0);
  const suggestions = buildSuggestions(breakdown, metadata, competitors);

  return { score, breakdown, suggestions };
}
