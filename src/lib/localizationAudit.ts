import { scoreDescription, scoreSubtitle, scoreTitle } from "./health";
import type { StorePlatform } from "./stores/types";
import { LOCALE_CANDIDATES } from "./localeCandidates";

export interface ContentIssue {
  type: "title_not_localized" | "foreign_script" | "meta_leak" | "citation_artifact";
  field: "title" | "subtitle" | "description";
  message: string;
  snippet?: string;
  penalty: number;
}

export interface LocaleHealthResult {
  score: number;
  breakdown: { key: string; label: string; score: number; max: number; message: string }[];
  issues: ContentIssue[];
  titleLocalized: boolean;
}

// Ranges kept narrow (not full Unicode blocks) so they only fire on real
// running text, not the odd stray codepoint. Latin is deliberately absent -
// it's allowed everywhere (brand names, "AI", punctuation-adjacent loanwords).
const SCRIPT_RANGES: Record<string, RegExp> = {
  cyrillic: /[Ѐ-ӿ]{2,}/,
  han: /[一-鿿]{2,}/,
  kana: /[぀-ヿ]{2,}/,
  hangul: /[가-힣]{2,}/,
  arabic: /[؀-ۿ]{2,}/,
  devanagari: /[ऀ-ॿ]{2,}/,
  thai: /[฀-๿]{2,}/,
};

// Leftover AI-assistant meta-commentary that occasionally gets pasted
// straight into a store listing along with the copy it was asked to
// produce - e.g. "3487 символов ✅ Вот финальный текст:" prefixing an
// otherwise-fine Dutch description. These fire regardless of the target
// locale since the leak is in whatever language the generating assistant
// was itself working in (often English or Russian), not the listing's.
const META_LEAK_PATTERNS: RegExp[] = [
  /\b\d+\s*(characters?|символов|caractères|zeichen|znaków|caratteri|caracteres)/i,
  /\bвот\s+финальный\s+текст\b/i,
  /\bfinal\s+(text|version)\s*[:：]/i,
  /✅\s*(вот|here'?s|final)/i,
];

// Names that showed up mid-sentence in the real live descriptions during a
// manual audit - almost certainly unstripped source-citation labels from
// whatever research/fact-checking tool generated the rare-coin value claims
// (e.g. "...alcanza los 36.000€ en subasta. ASOMobile En muchos hogares...").
// A hardcoded list rather than a heuristic because the pattern (a lone
// capitalized brand-looking token dropped between sentences) is too easily
// confused with genuine product names to detect generically.
const KNOWN_CITATION_TOKENS = [
  "Accio",
  "ASOMobile",
  "ASO World",
  "MobileAction",
  "AppTweak",
  "Sensor Tower",
  "AppFollow",
  "data.ai",
  "The Emory Wheel",
];

function findSnippet(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(text.length, index + len + 25);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function detectFieldIssues(
  field: ContentIssue["field"],
  text: string | null,
  ownScripts: string[],
): ContentIssue[] {
  if (!text) return [];
  const issues: ContentIssue[] = [];

  for (const [script, regex] of Object.entries(SCRIPT_RANGES)) {
    if (ownScripts.includes(script)) continue;
    const match = regex.exec(text);
    if (match) {
      issues.push({
        type: "foreign_script",
        field,
        message: `Contains unexpected ${script} text - likely leaked/untranslated content.`,
        snippet: findSnippet(text, match.index, match[0].length),
        penalty: 10,
      });
      break; // one foreign-script hit is enough signal; don't stack per-script
    }
  }

  for (const pattern of META_LEAK_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      issues.push({
        type: "meta_leak",
        field,
        message: "Contains a leftover AI-generation note (e.g. a character count or \"final text\" marker) that was never stripped before publishing.",
        snippet: findSnippet(text, match.index, match[0].length),
        penalty: 15,
      });
      break;
    }
  }

  for (const token of KNOWN_CITATION_TOKENS) {
    const index = text.indexOf(token);
    if (index !== -1) {
      issues.push({
        type: "citation_artifact",
        field,
        message: `Contains a stray citation-like token ("${token}") dropped mid-sentence - likely an unstripped source label from AI-assisted copywriting.`,
        snippet: findSnippet(text, index, token.length),
        penalty: 8,
      });
    }
  }

  return issues;
}

/** A locale's title counts as localized only if it's provably different
 * from the base English title/name - equal (case/whitespace-insensitive)
 * means the storefront is silently serving the English fallback for that
 * field even though Play Console lists the locale as translated. */
export function isTitleLocalized(localeCode: string, localeTitle: string | null, baseTitle: string | null): boolean {
  if (localeCode === "en" || localeCode.startsWith("en-")) return true;
  if (!localeTitle) return false;
  if (!baseTitle) return true;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(localeTitle) !== norm(baseTitle);
}

export function computeLocaleHealthReport(
  platform: StorePlatform,
  localeCode: string,
  metadata: { title: string | null; subtitle: string | null; description: string | null },
  titleLocalized: boolean,
): LocaleHealthResult {
  const candidate = LOCALE_CANDIDATES.find((c) => c.code === localeCode);
  const ownScripts = candidate?.ownScripts ?? [];

  const titleBreakdown = scoreTitle(platform, metadata.title);
  const subtitleBreakdown = scoreSubtitle(platform, metadata.subtitle);
  const descriptionBreakdown = scoreDescription(platform, metadata.description);

  const issues: ContentIssue[] = [
    ...detectFieldIssues("title", metadata.title, ownScripts),
    ...detectFieldIssues("subtitle", metadata.subtitle, ownScripts),
    ...detectFieldIssues("description", metadata.description, ownScripts),
  ];

  if (!titleLocalized) {
    issues.unshift({
      type: "title_not_localized",
      field: "title",
      message: "The app title/name isn't translated for this storefront - it's silently falling back to the English listing, even though other fields are localized.",
      penalty: 12,
    });
  }

  const contentQualityMax = 30;
  const penalty = issues.reduce((sum, i) => sum + i.penalty, 0);
  const contentQualityScore = Math.max(0, contentQualityMax - penalty);
  const contentQualityMessage =
    issues.length === 0 ? "No leaked or untranslated content detected." : `${issues.length} content issue${issues.length === 1 ? "" : "s"} found.`;

  const breakdown = [
    { key: "title", label: "Title", score: titleBreakdown.score, max: titleBreakdown.max, message: titleBreakdown.message },
    { key: "subtitle", label: "Subtitle", score: subtitleBreakdown.score, max: subtitleBreakdown.max, message: subtitleBreakdown.message },
    { key: "description", label: "Description", score: descriptionBreakdown.score, max: descriptionBreakdown.max, message: descriptionBreakdown.message },
    { key: "contentQuality", label: "Content Quality", score: contentQualityScore, max: contentQualityMax, message: contentQualityMessage },
  ];

  const rawScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const rawMax = breakdown.reduce((sum, b) => sum + b.max, 0);
  const score = Math.round((rawScore / rawMax) * 100);

  return { score, breakdown, issues, titleLocalized };
}
