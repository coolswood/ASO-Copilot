import { STOPWORDS } from "./research";

// research.ts's STOPWORDS is deliberately minimal - it's built for extracting
// keywords from concise app title/subtitle marketing copy, where words like
// "this", "have", "just", "very" essentially never show up. Review text is
// free-form natural English, where those *are* the most frequent words, so
// without filtering them out they drown out every real theme.
const REVIEW_STOPWORDS = new Set([
  ...STOPWORDS,
  "this", "that", "these", "those", "have", "has", "had", "having",
  "very", "just", "like", "when", "where", "what", "which", "who", "whom",
  "with", "without", "was", "were", "been", "being", "from", "they", "them",
  "their", "than", "then", "into", "more", "most", "some", "such", "only",
  "other", "would", "could", "should", "about", "after", "before", "because",
  // Contraction fragments after apostrophe-stripping ("doesn't" -> "doesn"
  // "t") - listed without the apostrophe since punctuation is stripped
  // before tokenizing.
  "while", "does", "did", "didn", "doesn", "wasn", "aren",
  "there", "here", "will", "shall", "cannot", "make", "made",
  "using", "used", "use", "really", "actually",
  "much", "many", "even", "still", "also", "back", "want", "wanted", "need",
  "needed", "keep", "keeps", "kept", "know", "knew", "think", "thought",
  "something", "anything", "everything", "nothing", "someone", "anyone",
  "everyone", "always", "never", "every", "each", "same", "again", "over",
  "under", "please", "thanks", "thank", "going", "seems", "seem", "seemed",
  "sure", "maybe", "probably", "definitely", "literally", "basically",
  "ever", "quite", "rather", "somewhat", "totally", "completely",
  "absolutely", "entirely", "mostly", "largely", "generally", "typically",
  "usually", "often", "rarely", "sometimes", "currently", "recently",
  "lately", "previously", "initially", "eventually", "finally",
  "immediately", "instantly", "constantly", "consistently", "regularly",
  "occasionally", "honestly", "clearly", "obviously", "apparently",
]);

// Praise/complaint themes are meant for humans reading "why do people like or
// dislike this app" - "love"/"amazing"/"frustrating" are exactly the right
// words to show there. But those same generic sentiment/opinion words are
// useless as *keyword* candidates (nobody searches an app store for "love" or
// "life"), so keyword-gap extraction filters them out separately rather than
// reusing the theme list verbatim.
export const GENERIC_SENTIMENT_WORDS = new Set([
  "love", "loved", "loves", "like", "liked", "likes", "hate", "hated", "hates",
  "life", "work", "works", "working", "tool", "business", "easy", "hard",
  "simple", "difficult", "amazing", "awesome", "great", "good", "bad",
  "terrible", "horrible", "awful", "nice", "best", "worst", "continue",
  "favorite", "favourite", "wonderful", "fantastic", "perfect", "useful",
  "helpful", "powerful", "incredible", "disappointing", "disappointed",
  "frustrating", "frustrated", "annoying", "convenient", "reliable",
  "unreliable", "quality", "value", "worth", "recommend", "recommended",
  "satisfied", "unsatisfied", "happy", "unhappy", "sad", "angry", "glad",
  "thankful", "grateful", "excellent", "poor", "decent", "solid", "brilliant",
]);

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewTheme {
  term: string;
  count: number;
}

export interface ReviewLike {
  rating: number | null;
  title: string | null;
  text: string | null;
  authorName: string | null;
  reviewedAt: Date | null;
}

export interface ReviewAnalysis {
  totalReviews: number;
  averageRating: number | null;
  ratingDistribution: RatingDistribution;
  positiveThemes: ReviewTheme[];
  negativeThemes: ReviewTheme[];
  recentPositive: ReviewLike[];
  recentNegative: ReviewLike[];
}

const MIN_THEME_WORD_LENGTH = 4;
const MIN_THEME_MENTIONS = 2;

/** Word-frequency theme extraction over a set of reviews - counts how many
 * *reviews* mention a word (not raw occurrences, so one ranting review can't
 * dominate), filtered to real words and a minimum mention count so a single
 * one-off word doesn't show up as a "theme". No LLM call: this tool is
 * self-hosted with no external AI dependency, matching the same heuristic
 * approach already used for keyword volume/difficulty scoring. */
function extractThemes(reviews: ReviewLike[], excludeTerms: Set<string>, max = 8): ReviewTheme[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const text = `${r.title ?? ""} ${r.text ?? ""}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const words = text
      .split(/\s+/)
      .filter((w) => w.length >= MIN_THEME_WORD_LENGTH && !REVIEW_STOPWORDS.has(w) && !excludeTerms.has(w));
    const seenInReview = new Set<string>();
    for (const w of words) {
      if (seenInReview.has(w)) continue;
      seenInReview.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= MIN_THEME_MENTIONS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term, count]) => ({ term, count }));
}

function mostRecent(reviews: ReviewLike[], max = 5): ReviewLike[] {
  return [...reviews]
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
    .slice(0, max);
}

/** `appName` (if given) excludes the app's own brand words from themes -
 * "reviews mention the app's name" isn't a theme, it's just true of every
 * review of anything. */
export function computeReviewAnalysis(reviews: ReviewLike[], appName?: string | null): ReviewAnalysis {
  const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let ratingCount = 0;
  for (const r of reviews) {
    if (r.rating && r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
      ratingSum += r.rating;
      ratingCount += 1;
    }
  }

  const negative = reviews.filter((r) => (r.rating ?? 0) > 0 && (r.rating ?? 0) <= 2);
  const positive = reviews.filter((r) => (r.rating ?? 0) >= 4);
  const excludeTerms = new Set(
    (appName ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );

  return {
    totalReviews: reviews.length,
    averageRating: ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : null,
    ratingDistribution: distribution,
    positiveThemes: extractThemes(positive, excludeTerms),
    negativeThemes: extractThemes(negative, excludeTerms),
    recentPositive: mostRecent(positive),
    recentNegative: mostRecent(negative),
  };
}
