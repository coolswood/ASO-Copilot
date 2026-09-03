import { Fragment, useRef, useState } from "react";
import { ChevronDown, Copy, Minus, Sparkles, Tags, TrendingDown, TrendingUp } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import RankSparkline from "./RankSparkline";
import RankHistoryChart from "./RankHistoryChart";
import KeywordsOverviewChart from "./KeywordsOverviewChart";
import { CountryChip, storefrontLabel } from "./countryShared";
import { appStoreSearchUrl, playStoreSearchUrl } from "@/lib/storeLinks";
import { SCAN_COUNTRIES } from "@/lib/countries";
import type { StorePlatform } from "@/lib/stores/types";

function RankDelta({ latest, previous }: { latest: number | null; previous: number | null }) {
  if (latest === null || previous === null) return null;
  const delta = previous - latest;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const improved = delta > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium"
      style={{ color: improved ? "var(--success)" : "var(--danger)" }}
    >
      {improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta)}
    </span>
  );
}

interface KeywordWithRanks {
  id: string;
  term: string;
  country: string;
  volume: number | null;
  difficulty: number | null;
  ranks: { position: number | null; checkedAt: string | Date }[];
}

// Apple's App Store Connect "Keywords" field is a single comma-separated
// string capped at 100 characters (per locale) - Google Play has no
// equivalent discrete field (Play's algorithm infers relevance from the
// title/description text itself), so only iOS needs the fit-as-many-as-
// possible packing below.
const APPLE_KEYWORDS_LIMIT = 100;

interface KeywordField {
  text: string;
  includedCount: number;
  omittedCount: number;
}

/** Greedily fits as many terms as possible into `limit` chars (comma-joined,
 * no spaces, to match App Store Connect convention and save budget) rather
 * than truncating in order - a later short keyword that still fits shouldn't
 * be dropped just because an earlier long one didn't. */
function buildKeywordField(terms: string[], limit?: number): KeywordField {
  const unique = Array.from(new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  if (!limit) {
    return { text: unique.join(","), includedCount: unique.length, omittedCount: 0 };
  }

  const included: string[] = [];
  let length = 0;
  for (const term of unique) {
    const nextLength = included.length === 0 ? term.length : length + 1 + term.length;
    if (nextLength > limit) continue;
    included.push(term);
    length = nextLength;
  }
  return { text: included.join(","), includedCount: included.length, omittedCount: unique.length - included.length };
}

export default function KeywordsSection({
  appId,
  platform,
  keywords,
  onChanged,
}: {
  appId: string;
  platform: StorePlatform;
  keywords: KeywordWithRanks[];
  /** Re-fetches the app after keyword mutations (was router.refresh()
   * against the server component in the Next.js app). */
  onChanged?: () => void;
}) {
  const [term, setTerm] = useState("");
  const [newCountry, setNewCountry] = useState("us");
  const [countryFilter, setCountryFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Storefronts actually in use by this app's keywords, in a stable order -
  // drives the filter dropdown so it never offers a country with no keywords.
  const trackedCountries = Array.from(new Set(keywords.map((k) => k.country))).sort();
  const filtered = countryFilter ? keywords.filter((k) => k.country === countryFilter) : keywords;

  async function copyKeywords() {
    const limit = platform === "IOS" ? APPLE_KEYWORDS_LIMIT : undefined;
    // Operates on the visible (filtered) set only: the App Store Connect
    // Keywords field is per-locale, so joining terms from different storefronts
    // into one list would produce a field nobody can paste anywhere.
    const field = buildKeywordField(
      filtered.map((k) => k.term),
      limit,
    );
    try {
      await navigator.clipboard.writeText(field.text);
      setCopyStatus(
        field.omittedCount > 0
          ? `Copied ${field.includedCount} keywords (${field.text.length}/${limit} chars, ${field.omittedCount} left out)`
          : `Copied ${field.includedCount} keyword${field.includedCount === 1 ? "" : "s"}${limit ? ` (${field.text.length}/${limit} chars)` : ""}`,
      );
    } catch {
      setCopyStatus("Couldn't copy - clipboard access denied");
    } finally {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(null), 4000);
    }
  }

  async function autoDetect() {
    setDetecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords/auto-detect`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to auto-detect keywords");
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  async function addKeyword() {
    if (!term.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, country: newCountry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add keyword");
      setTerm("");
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeKeyword(keywordId: string) {
    await fetch(`/api/apps/${appId}/keywords/${keywordId}`, { method: "DELETE" });
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          placeholder="Add a keyword to track..."
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors focus:border-accent"
        />
        <select
          value={newCountry}
          onChange={(e) => setNewCountry(e.target.value)}
          title="Storefront to track the keyword in - the storefront decides which language's search results you compete in"
          aria-label="Storefront country for the new keyword"
          className="shrink-0 rounded-lg border border-border bg-card px-2 py-2 text-sm text-muted transition-colors focus:border-accent"
        >
          {SCAN_COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {storefrontLabel(country)} ({country})
            </option>
          ))}
        </select>
        <button
          onClick={addKeyword}
          disabled={adding}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          {adding ? "Adding..." : "Track"}
        </button>
        <button
          onClick={autoDetect}
          disabled={detecting}
          title={detecting ? "Detecting..." : "Auto-detect keywords from your title and subtitle"}
          aria-label="Auto-detect keywords"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 hover:bg-card hover:border-accent disabled:opacity-50"
        >
          <Sparkles className={`h-3.5 w-3.5 ${detecting ? "animate-pulse" : ""}`} />
        </button>
        {keywords.length > 0 && (
          <button
            onClick={copyKeywords}
            title={
              platform === "IOS"
                ? "Copy for App Store: joins every tracked keyword into one comma-separated list, packed to fit the App Store Connect Keywords field's 100-character limit, and copies it."
                : "Copy keywords: joins every tracked keyword into one comma-separated list and copies it."
            }
            aria-label="Copy keywords"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 hover:bg-card hover:border-accent"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {copyStatus && <div className="text-xs text-muted animate-fade-in-up">{copyStatus}</div>}
      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {trackedCountries.length > 1 && (
        <div className="flex items-center gap-2 text-sm animate-fade-in-up">
          <span className="text-muted text-xs">Storefront:</span>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            aria-label="Filter keywords by storefront"
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm transition-colors focus:border-accent"
          >
            <option value="">All ({keywords.length})</option>
            {trackedCountries.map((country) => (
              <option key={country} value={country}>
                {storefrontLabel(country)} ({country}) - {keywords.filter((k) => k.country === country).length}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length > 1 && (
        <div className="animate-fade-in-up">
          <KeywordsOverviewChart keywords={filtered} />
        </div>
      )}

      {keywords.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
            <Tags className="h-5 w-5 text-muted" />
          </div>
          <div className="text-sm text-muted max-w-sm">
            No keywords tracked yet. Add one above, or hit{" "}
            <button onClick={autoDetect} className="text-accent font-medium hover:underline" disabled={detecting}>
              Auto-detect
            </button>{" "}
            to pull candidates straight from your title and subtitle.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="p-3 font-medium">Keyword</th>
                <th className="p-3 font-medium">Current rank</th>
                <th className="p-3 font-medium">Trend</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => {
                const chronological = [...k.ranks].reverse();
                const latest = k.ranks[0]?.position ?? null;
                const previous = k.ranks[1]?.position ?? null;
                const isOpen = expanded === k.id;
                return (
                  <Fragment key={k.id}>
                    <tr
                      className="animate-fade-in-up border-b border-border last:border-0 transition-colors hover:bg-background"
                      style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{k.term}</span>
                          <CountryChip country={k.country} />
                          <a
                            href={appStoreSearchUrl(k.term)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search on the App Store"
                            aria-label={`Search "${k.term}" on the App Store`}
                            className="text-muted hover:text-accent"
                          >
                            <SiAppstore className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={playStoreSearchUrl(k.term)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search on Google Play"
                            aria-label={`Search "${k.term}" on Google Play`}
                            className="text-muted hover:text-accent"
                          >
                            <SiGoogleplay className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{latest !== null ? `#${latest}` : "Not ranked"}</span>
                          <RankDelta latest={latest} previous={previous} />
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setExpanded(isOpen ? null : k.id)}
                          className="inline-flex items-center gap-1.5 hover:text-accent"
                          aria-expanded={isOpen}
                          title="Show rank history"
                        >
                          <RankSparkline positions={chronological.map((r) => r.position)} />
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => removeKeyword(k.id)}
                          className="text-muted hover:text-red-500 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="animate-fade-in-up border-b border-border last:border-0">
                        <td colSpan={4} className="bg-background p-3">
                          <RankHistoryChart ranks={k.ranks} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
