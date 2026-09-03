import { useMemo, useState } from "react";
import { Search as SearchIcon, SearchX, SlidersHorizontal } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import AppIcon from "@/components/AppIcon";
import CountrySelect from "@/components/CountrySelect";
import MetricBar from "@/components/MetricBar";
import { appStoreSearchUrl, playStoreSearchUrl } from "@/lib/storeLinks";
import type { StorePlatform } from "@/lib/stores/types";

interface RankingApp {
  storeId: string;
  name: string;
  iconUrl: string | null;
}

interface KeywordIdea {
  term: string;
  volume: number;
  difficulty: number;
  resultCount: number;
  apps: RankingApp[];
}

const APPS_SHOWN = 5;

function RangeFilter({
  label,
  min,
  max,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={min}
        onChange={(e) => onChange(clamp(Number(e.target.value)), max)}
        className="w-14 rounded-lg border border-border bg-card px-2 py-1 text-xs transition-colors focus:border-accent"
      />
      <span className="text-xs text-muted">–</span>
      <input
        type="number"
        min={0}
        max={100}
        value={max}
        onChange={(e) => onChange(min, clamp(Number(e.target.value)))}
        className="w-14 rounded-lg border border-border bg-card px-2 py-1 text-xs transition-colors focus:border-accent"
      />
    </div>
  );
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function KeywordSearchPage() {
  const [platform, setPlatform] = useState<StorePlatform>("ANDROID");
  const [country, setCountry] = useState("us");
  const [term, setTerm] = useState("");
  const [deep, setDeep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<KeywordIdea[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [popRange, setPopRange] = useState<[number, number]>([0, 100]);
  const [diffRange, setDiffRange] = useState<[number, number]>([0, 100]);

  const filtersActive =
    popRange[0] > 0 || popRange[1] < 100 || diffRange[0] > 0 || diffRange[1] < 100;

  const filteredResults = useMemo(() => {
    if (!results) return null;
    if (!filtersActive) return results;
    return results.filter(
      (r) =>
        r.volume >= popRange[0] &&
        r.volume <= popRange[1] &&
        r.difficulty >= diffRange[0] &&
        r.difficulty <= diffRange[1],
    );
  }, [results, filtersActive, popRange, diffRange]);

  function resetFilters() {
    setPopRange([0, 100]);
    setDiffRange([0, 100]);
  }

  async function search() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ platform, term: term.trim(), country });
      if (deep) params.set("deep", "1");
      const res = await fetch(`/api/keyword-ideas?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Keyword Search</h1>
        <p className="text-sm text-muted mb-6">
          Find related keyword ideas with demand, difficulty, and who currently ranks for each one.
        </p>
      </div>

      <div className="animate-fade-in-up [animation-delay:60ms] flex flex-wrap items-center gap-2">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as StorePlatform)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent"
        >
          <option value="ANDROID">Google Play</option>
          <option value="IOS">App Store</option>
        </select>
        <CountrySelect
          value={country}
          onChange={setCountry}
          title="Storefront to search in - demand, difficulty and ranking apps are measured against this market's own results"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search any keyword..."
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors focus:border-accent"
        />
        <button
          onClick={search}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          <SearchIcon className={`h-3.5 w-3.5 ${loading ? "animate-pulse" : ""}`} />
          {loading ? "Searching..." : "Search"}
        </button>
        {!loading && results && (
          <span className="animate-fade-in-up rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted">
            {filtersActive
              ? `Showing ${filteredResults?.length ?? 0} of ${results.length} keyword ideas`
              : `Found ${results.length} keyword idea${results.length === 1 ? "" : "s"}`}
          </span>
        )}
        {!loading && results && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showFilters || filtersActive
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted hover:border-accent hover:text-accent"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        )}
      </div>

      <label className="animate-fade-in-up [animation-delay:100ms] mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={deep}
          onChange={(e) => setDeep(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Deep search (up to 40 ideas instead of 20)
      </label>

      {showFilters && results && (
        <div className="animate-fade-in-up mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <RangeFilter
            label="Popularity"
            min={popRange[0]}
            max={popRange[1]}
            onChange={(min, max) => setPopRange([min, max])}
          />
          <div className="h-4 w-px bg-border" />
          <RangeFilter
            label="Difficulty"
            min={diffRange[0]}
            max={diffRange[1]}
            onChange={(min, max) => setDiffRange([min, max])}
          />
          {filtersActive && (
            <button onClick={resetFilters} className="text-xs text-muted hover:text-accent">
              Reset
            </button>
          )}
        </div>
      )}

      {error && <div className="text-sm text-red-500 animate-fade-in-up mt-4">{error}</div>}

      {loading && (
        <div className="animate-fade-in mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="p-3 font-medium">Keyword</th>
                <th className="p-3 font-medium">Popularity</th>
                <th className="p-3 font-medium">Difficulty</th>
                <th className="p-3 font-medium">Apps in ranking</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div
                      className="h-4 rounded bg-border animate-pulse"
                      style={{ width: `${65 - i * 4}%`, animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-3 w-20 rounded bg-border animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-3 w-20 rounded bg-border animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div
                          key={j}
                          className="h-6 w-6 rounded-full bg-border animate-pulse"
                          style={{ animationDelay: `${i * 80 + j * 30}ms` }}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading &&
        filteredResults &&
        (filteredResults.length === 0 ? (
          <div className="animate-fade-in-up mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
              <SearchX className="h-5 w-5 text-muted" />
            </div>
            <div className="text-sm text-muted">
              {filtersActive
                ? "No keyword ideas match this range."
                : "No keyword ideas found for this term."}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in-up mt-6 rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="p-3 font-medium">Keyword</th>
                  <th className="p-3 font-medium">Popularity</th>
                  <th className="p-3 font-medium">Difficulty</th>
                  <th className="p-3 font-medium">Apps in ranking</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => {
                  const overflow = Math.max(0, r.resultCount - r.apps.length);
                  return (
                    <tr
                      key={r.term}
                      className="animate-fade-in-up border-b border-border last:border-0 transition-colors hover:bg-background"
                      style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium whitespace-nowrap">{r.term}</span>
                          <a
                            href={appStoreSearchUrl(r.term, country)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search on the App Store"
                            aria-label={`Search "${r.term}" on the App Store`}
                            className="text-muted hover:text-accent"
                          >
                            <SiAppstore className="h-3 w-3" />
                          </a>
                          <a
                            href={playStoreSearchUrl(r.term)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search on Google Play"
                            aria-label={`Search "${r.term}" on Google Play`}
                            className="text-muted hover:text-accent"
                          >
                            <SiGoogleplay className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="p-3">
                        <MetricBar value={r.volume} />
                      </td>
                      <td className="p-3">
                        <MetricBar value={r.difficulty} inverse />
                      </td>
                      <td className="p-3">
                        {r.apps.length === 0 ? (
                          <span className="text-xs text-muted">No apps found</span>
                        ) : (
                          <div className="flex items-center">
                            <div className="flex -space-x-2">
                              {r.apps.slice(0, APPS_SHOWN).map((app) => (
                                <AppIcon
                                  key={app.storeId}
                                  src={app.iconUrl}
                                  className="h-6 w-6 rounded-full border-2 border-card shrink-0"
                                />
                              ))}
                            </div>
                            {overflow > 0 && (
                              <span className="ml-1.5 text-xs text-muted">+{overflow}</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
