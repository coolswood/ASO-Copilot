import { useState } from "react";
import { Search, SearchX, Sparkles, Users } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { metricColor } from "@/lib/metricColor";
import { appStoreSearchUrl, playStoreSearchUrl } from "@/lib/storeLinks";

interface Suggestion {
  term: string;
  volume: number;
  difficulty: number;
  rank: number | null;
}

interface NewCompetitor {
  id: string;
  name: string;
  iconUrl: string | null;
}

export default function ResearchSection({ appId, onChanged }: { appId: string; onChanged?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [newCompetitors, setNewCompetitors] = useState<NewCompetitor[]>([]);

  async function findKeywords() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/research`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      setSuggestions(data.suggestions);
      setNewCompetitors(data.newCompetitors ?? []);
      if (data.newCompetitors?.length > 0) onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function trackTerm(term: string) {
    setTracking(term);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev?.filter((s) => s.term !== term) ?? null);
        onChanged?.();
      }
    } finally {
      setTracking(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={findKeywords}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          {loading ? (
            <Search className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Analyzing store data..." : "Find winning keywords"}
        </button>
        <span className="text-xs text-muted">
          Derives candidates from your title/subtitle and competitors, then estimates
          demand and competitiveness from live store search results.
        </span>
      </div>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {newCompetitors.length > 0 && (
        <div className="animate-fade-in-up flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Users className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-muted">
            Also found and started tracking{" "}
            <span className="text-foreground font-medium">
              {newCompetitors.map((c) => c.name).join(", ")}
            </span>{" "}
            as competitor{newCompetitors.length === 1 ? "" : "s"}.
          </span>
        </div>
      )}

      {loading && (
        <div className="animate-fade-in rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="p-3 font-medium">Keyword</th>
                <th className="p-3 font-medium">Volume</th>
                <th className="p-3 font-medium">Difficulty</th>
                <th className="p-3 font-medium">Current rank</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div
                      className="h-4 rounded bg-border animate-pulse"
                      style={{ width: `${70 - i * 6}%`, animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-4 w-8 rounded bg-border animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-4 w-8 rounded bg-border animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-4 w-10 rounded bg-border animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                  <td className="p-3">
                    <div
                      className="h-6 w-14 rounded-lg bg-border animate-pulse ml-auto"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && suggestions && (
        suggestions.length === 0 ? (
          <div className="animate-fade-in-up flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
              <SearchX className="h-5 w-5 text-muted" />
            </div>
            <div className="text-sm text-muted">No new keyword opportunities found.</div>
          </div>
        ) : (
          <div className="animate-fade-in-up rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="p-3 font-medium">Keyword</th>
                  <th className="p-3 font-medium">Volume</th>
                  <th className="p-3 font-medium">Difficulty</th>
                  <th className="p-3 font-medium">Current rank</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr
                    key={s.term}
                    className="animate-fade-in-up border-b border-border last:border-0 transition-colors hover:bg-background"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.term}</span>
                        <a
                          href={appStoreSearchUrl(s.term)}
                          target="_blank"
                          rel="noreferrer"
                          title="Search on the App Store"
                          aria-label={`Search "${s.term}" on the App Store`}
                          className="text-muted hover:text-accent"
                        >
                          <SiAppstore className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={playStoreSearchUrl(s.term)}
                          target="_blank"
                          rel="noreferrer"
                          title="Search on Google Play"
                          aria-label={`Search "${s.term}" on Google Play`}
                          className="text-muted hover:text-accent"
                        >
                          <SiGoogleplay className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="p-3">
                      <span style={{ color: metricColor(s.volume) }}>{s.volume}</span>
                    </td>
                    <td className="p-3">
                      <span style={{ color: metricColor(s.difficulty, true) }}>{s.difficulty}</span>
                    </td>
                    <td className="p-3 text-muted">{s.rank !== null ? `#${s.rank}` : "Not ranked"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => trackTerm(s.term)}
                        disabled={tracking === s.term}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground hover:border-accent disabled:opacity-50"
                      >
                        {tracking === s.term ? "Adding..." : "Track"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
