import * as stores from "./stores";
import type { StorePlatform, StoreSearchHit } from "./stores/types";

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with", "your",
  "app", "apps", "free", "best", "new", "get", "all", "you", "is", "by", "&",
  // Generic marketing filler that shows up in casual title/subtitle copy
  // ("...in this fun adventure game!") but is never itself a real search
  // term - same reasoning as excluding "free"/"best"/"new" above.
  "this", "that", "fun", "great",
]);


export function extractSeedTerms(text: string | null | undefined, max = 8): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      seeds.push(w);
    }
    if (seeds.length >= max) break;
  }
  return seeds;
}

/** Derives keyword *phrases* (not isolated words) by pairing each word with
 * the next one in its original order in the text - "Coin Identifier" from a
 * title stays "coin identifier", not two separate "coin"/"identifier" tags.
 * Used for display (e.g. "what keywords does this app target") where single
 * tokenized words read as noise rather than real ASO keywords. */
export function extractKeywordPhrases(text: string | null | undefined, max = 6): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const seen = new Set<string>();
  const seenPair = new Set<string>();
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1 && phrases.length < max; i++) {
    if (words[i] === words[i + 1]) continue;
    const phrase = `${words[i]} ${words[i + 1]}`;
    // Order-independent key so "coin identifier" and a later "identifier
    // coin" (e.g. from title/subtitle running into each other) collapse to
    // one tag instead of showing the same two words twice.
    const pairKey = [words[i], words[i + 1]].sort().join(" ");
    if (seenPair.has(pairKey)) continue;
    seenPair.add(pairKey);
    seen.add(phrase);
    phrases.push(phrase);
  }

  // Very short titles/subtitles might not yield enough adjacent pairs -
  // pad with leftover single words rather than returning too few tags.
  if (phrases.length < max) {
    for (const w of words) {
      if (phrases.length >= max) break;
      if (seen.has(w) || phrases.some((p) => p.includes(w))) continue;
      seen.add(w);
      phrases.push(w);
    }
  }

  return phrases;
}

/** Builds keyword candidates purely from the app's own extracted vocabulary -
 * pairing seeds with each other ("coin" + "identifier" -> "coin identifier",
 * "identifier coin"). These read as genuine search queries because they're
 * built from words the listing itself already uses, unlike bolting a fixed
 * generic modifier ("app", "pro", "vs"...) onto a brand name, which produces
 * combos nobody actually searches for. This is intentionally just a local
 * fallback: the real "similar keyword" discovery is the store autocomplete
 * data pulled in research/route.ts, which reflects actual user queries. */
export function expandCandidates(seeds: string[], maxCandidates = 12): string[] {
  const candidates = new Set<string>();
  for (const seed of seeds) candidates.add(seed);

  outer: for (let i = 0; i < seeds.length; i++) {
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      candidates.add(`${seeds[i]} ${seeds[j]}`);
      if (candidates.size >= maxCandidates) break outer;
    }
  }

  return Array.from(candidates).slice(0, maxCandidates);
}

// Words too generic to seed a locale keyword search even once translated -
// kept intentionally short (a handful of universal filler words plus the
// brand name) rather than trying to maintain a stopword list per language,
// since the length/distinctiveness filter below does most of the real work.
const LOCALE_STOPWORDS = new Set(["numisma", "app", "free", "premium", "ai"]);

// Adverb endings that recur across the Romance languages this tool
// localizes into (Spanish/Portuguese/Italian "-mente", French "-ment") -
// filtered out because they're reliably generic connective filler
// ("automáticamente", "rapidamente", "automatiquement") that happens to be
// long, so a pure length-based seed ranking picks them over the actual
// product nouns nearby and autocomplete then returns junk from a totally
// unrelated app category.
const ADVERB_SUFFIXES = ["mente", "ment"];

/** Unicode-aware version of extractSeedTerms - that one strips anything
 * outside `[a-z0-9]`, which reduces non-Latin-script text (Cyrillic,
 * Japanese, Arabic...) to almost nothing. This splits on whitespace and
 * keeps any run of Unicode letters/numbers, so real translated copy (not
 * just English) can be used to seed keyword discovery in its own locale. Not
 * meaningful for scripts that don't space-delimit words (Japanese, Chinese)
 * - callers should expect thin/empty results there and degrade gracefully. */
export function extractUnicodeSeedTerms(text: string | null | undefined, max = 6): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (w) => w.length >= 4 && !LOCALE_STOPWORDS.has(w) && !ADVERB_SUFFIXES.some((suf) => w.endsWith(suf)),
    );

  // Longer, more distinctive words make better autocomplete seeds than
  // common short ones ("value" beats "the") - sort by length as a cheap
  // proxy for specificity before deduping and capping.
  const seen = new Set<string>();
  const ranked = [...words].sort((a, b) => b.length - a.length);
  const seeds: string[] = [];
  for (const w of ranked) {
    if (seen.has(w)) continue;
    seen.add(w);
    seeds.push(w);
    if (seeds.length >= max) break;
  }
  return seeds;
}

/** Unicode-aware adjacent-word-pair phrases, same idea as
 * extractKeywordPhrases but for translated (non-Latin-safe) copy. A single
 * generic word ("scanner", "identifica", "archivia") autocompletes against
 * whatever app category is most popular for that word in general (QR
 * scanners, plant identifiers...), not coins specifically - pairing it with
 * its neighbor from the actual title/subtitle anchors the seed back onto
 * this product's own domain ("collezione monete" instead of "collezione"),
 * which is what actually produces on-topic autocomplete results. */
function extractUnicodeKeywordPhrases(text: string | null | undefined, max = 6): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (w) => w.length >= 3 && !LOCALE_STOPWORDS.has(w) && !ADVERB_SUFFIXES.some((suf) => w.endsWith(suf)),
    );

  const seenPair = new Set<string>();
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1 && phrases.length < max; i++) {
    if (words[i] === words[i + 1]) continue;
    const pairKey = [words[i], words[i + 1]].sort().join(" ");
    if (seenPair.has(pairKey)) continue;
    seenPair.add(pairKey);
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  return phrases;
}

const LOCALE_KEYWORD_PHRASE_SEED_LIMIT = 4;
const LOCALE_KEYWORD_WORD_SEED_LIMIT = 2;
const LOCALE_KEYWORD_RESULT_LIMIT = 12;

/** Real local-market search phrases for one storefront locale, discovered
 * from Play/App Store autocomplete rather than translated by a model.
 * Autocomplete barely translates a seed at all (querying "coin" against the
 * German store mostly just extends "coin..." in English) - so this only
 * produces useful results when seeded with words already in the target
 * language, which is why `seedText` should be that locale's own translated
 * title/subtitle/description (e.g. from a synced AppLocalization row), not
 * the English source copy. Best-effort: any locale/script this can't seed
 * or whose autocomplete errors out just yields an empty list, not a thrown
 * error, since this only ever feeds "nice to have" copy suggestions. */
export async function discoverLocaleKeywords(
  platform: StorePlatform,
  seedText: string,
  country: string,
  lang: string,
): Promise<string[]> {
  // Phrases first (better hit rate - see extractUnicodeKeywordPhrases),
  // topped up with a couple of single distinctive words in case the text is
  // too short to yield enough pairs.
  const phraseSeeds = extractUnicodeKeywordPhrases(seedText, LOCALE_KEYWORD_PHRASE_SEED_LIMIT);
  const wordSeeds = extractUnicodeSeedTerms(seedText, LOCALE_KEYWORD_WORD_SEED_LIMIT).filter(
    (w) => !phraseSeeds.some((p) => p.includes(w)),
  );
  const seeds = [...phraseSeeds, ...wordSeeds];
  if (seeds.length === 0) return [];

  const lists = await Promise.all(
    seeds.map((seed) => stores.autocompleteSuggestions(platform, seed, country, lang).catch(() => [])),
  );

  const seedSet = new Set(seeds);
  const seen = new Set<string>();
  const results: string[] = [];
  for (const phrase of lists.flat()) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized || seen.has(normalized) || seedSet.has(normalized)) continue;
    seen.add(normalized);
    results.push(phrase.trim());
    if (results.length >= LOCALE_KEYWORD_RESULT_LIMIT) break;
  }
  return results;
}

export interface KeywordScore {
  term: string;
  volume: number;
  difficulty: number;
  rank: number | null;
}

export interface KeywordIdea {
  term: string;
  volume: number;
  difficulty: number;
  resultCount: number;
}

/** Volume/difficulty are 0-100 heuristic scores. There's no free official
 * source for real App Store/Play Store search volume, so these are proxies:
 * volume from how many *relevant* listings match the term (apps whose name
 * actually contains every word of it, not just anything the store's fuzzy
 * search loosely associated with it), difficulty from the average review-
 * count authority of those relevant results. Using a relevance filter
 * matters - raw result counts from store search saturate near the same
 * value for almost any query (fuzzy matching returns a full page of loosely
 * related apps even for nonsense phrases), which made every candidate look
 * like it had identical demand. Filtering first means a real phrase like
 * "coin identifier" scores very differently from a bolted-together one like
 * "numisma widget" that no actual listing targets. */
function volumeAndDifficulty(resultCount: number, topAuthority: number): { volume: number; difficulty: number } {
  const volume = Math.round(Math.min(Math.log10(resultCount + 1) / Math.log10(40), 1) * 100);
  const difficulty = Math.round(Math.min(Math.log10(topAuthority + 1) / Math.log10(200000), 1) * 100);
  return { volume, difficulty };
}

export async function scoreKeyword(
  platform: StorePlatform,
  term: string,
  storeId: string,
  country = "us",
): Promise<KeywordScore> {
  const [{ resultCount, topAuthority }, rank] = await Promise.all([
    stores.analyzeTerm(platform, term, country),
    stores.findRank(platform, term, storeId, country),
  ]);
  return { term, ...volumeAndDifficulty(resultCount, topAuthority), rank };
}

/** Same volume/difficulty scoring as scoreKeyword, but for standalone keyword
 * research with no specific tracked app to rank against (so no findRank
 * call) - used by the general "Keyword Search" tool. Also surfaces the raw
 * relevant-result count, needed to show "N more apps ranking" beyond the
 * few icons displayed. */
export async function scoreKeywordIdea(
  platform: StorePlatform,
  term: string,
  country = "us",
): Promise<KeywordIdea> {
  const { resultCount, topAuthority } = await stores.analyzeTerm(platform, term, country);
  return { term, ...volumeAndDifficulty(resultCount, topAuthority), resultCount };
}

export async function scoreKeywords(
  platform: StorePlatform,
  terms: string[],
  storeId: string,
  country = "us",
): Promise<KeywordScore[]> {
  const settled = await Promise.allSettled(terms.map((term) => scoreKeyword(platform, term, storeId, country)));
  return settled
    .filter((r): r is PromiseFulfilledResult<KeywordScore> => r.status === "fulfilled")
    .map((r) => r.value);
}

export function keywordOpportunityRank(k: KeywordScore): number {
  return k.volume - k.difficulty * 0.7;
}

export interface KeywordIdeaWithApps extends KeywordIdea {
  apps: StoreSearchHit[];
}

const DISCOVERY_SUGGESTIONS = 20;
const DISCOVERY_SUGGESTIONS_DEEP = 40;
const DISCOVERY_APPS_PER_KEYWORD = 5;

/** Standalone keyword-idea discovery for any term, not tied to a tracked app.
 * Real user-query signal first (store autocomplete for the term itself and
 * its top seed words), then a local seed-pairing fallback so the list is
 * never thin even when a store's autocomplete comes back empty. Shared by
 * the /search page's API route and the MCP find_keyword_ideas tool so both
 * surfaces use identical discovery logic. */
export async function discoverKeywordIdeas(
  platform: StorePlatform,
  term: string,
  country = "us",
  deep = false,
): Promise<{ results: KeywordIdeaWithApps[]; totalCandidates: number }> {
  const cap = deep ? DISCOVERY_SUGGESTIONS_DEEP : DISCOVERY_SUGGESTIONS;
  const seeds = extractSeedTerms(term, 6);
  const autocompleteLists = await Promise.all(
    [term, ...seeds.slice(0, 4)].map((t) => stores.autocompleteSuggestions(platform, t, country)),
  );
  const local = expandCandidates(seeds.length > 0 ? seeds : [term], cap);

  const candidates = Array.from(new Set([term, ...autocompleteLists.flat(), ...local])).slice(0, cap);

  const settled = await Promise.allSettled(
    candidates.map(async (candidate): Promise<KeywordIdeaWithApps> => {
      const [idea, apps] = await Promise.all([
        scoreKeywordIdea(platform, candidate, country),
        stores.search(platform, candidate, country, DISCOVERY_APPS_PER_KEYWORD),
      ]);
      return { ...idea, apps };
    }),
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<KeywordIdeaWithApps> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.volume - a.volume || a.difficulty - b.difficulty);

  return { results, totalCandidates: candidates.length };
}
