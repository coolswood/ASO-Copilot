import { useState } from "react";
import { Users } from "lucide-react";
import AppSearchPicker, { SearchHit } from "./AppSearchPicker";
import AppIcon from "./AppIcon";
import { appStoreSearchUrl, playStoreListingUrl } from "@/lib/storeLinks";
import type { StorePlatform } from "@/lib/stores/types";

interface CompetitorRank {
  keywordId: string;
  position: number | null;
  checkedAt: string | Date;
}

interface CompetitorWithRanks {
  id: string;
  storeId: string;
  name: string;
  iconUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  ranks: CompetitorRank[];
}

function latestByKeyword(ranks: CompetitorRank[]): Map<string, CompetitorRank> {
  const map = new Map<string, CompetitorRank>();
  for (const r of ranks) {
    if (!map.has(r.keywordId)) map.set(r.keywordId, r);
  }
  return map;
}

// iOS falls back to an exact-name App Store search rather than a direct
// listing link - see playStoreListingUrl's doc comment for why.
function competitorUrl(
  platform: StorePlatform,
  storeId: string,
  name: string,
  country: string,
): string {
  return platform === "ANDROID" ? playStoreListingUrl(storeId) : appStoreSearchUrl(name, country);
}

export default function CompetitorsSection({
  appId,
  platform,
  country,
  competitors,
  keywords,
  onChanged,
}: {
  appId: string;
  platform: StorePlatform;
  /** Storefront resolved by the global selector - new competitors are added
   * for this market, and `keywords` columns are pre-filtered to it. */
  country: string;
  competitors: CompetitorWithRanks[];
  keywords: { id: string; term: string; country: string }[];
  /** Re-fetches the app after competitor mutations (was router.refresh()
   * against the server component in the Next.js app). */
  onChanged?: () => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(hit: SearchHit) {
    setError(null);
    const res = await fetch(`/api/apps/${appId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, storeId: hit.storeId, country }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add competitor");
      return;
    }
    setShowSearch(false);
    onChanged?.();
  }

  async function removeCompetitor(competitorId: string) {
    await fetch(`/api/apps/${appId}/competitors/${competitorId}`, { method: "DELETE" });
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowSearch((v) => !v)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-card hover:border-accent"
      >
        {showSearch ? "Cancel" : "+ Add competitor"}
      </button>

      {showSearch && (
        <div className="rounded-xl border border-border bg-card p-4">
          <AppSearchPicker
            platform={platform}
            country={country}
            allowPlatformChange={false}
            onSelect={handleSelect}
          />
        </div>
      )}
      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {competitors.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
            <Users className="h-5 w-5 text-muted" />
          </div>
          <div className="text-sm text-muted">No competitors tracked yet.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="p-3 font-medium sticky left-0 bg-card">Competitor</th>
                {keywords.map((k) => (
                  <th key={k.id} className="p-3 font-medium whitespace-nowrap">
                    {k.term}
                  </th>
                ))}
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => {
                const latest = latestByKeyword(c.ranks);
                return (
                  <tr
                    key={c.id}
                    className="group animate-fade-in-up border-b border-border last:border-0 transition-colors hover:bg-background"
                    style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
                  >
                    <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap transition-colors group-hover:bg-background">
                      <a
                        href={competitorUrl(platform, c.storeId, c.name, country)}
                        target="_blank"
                        rel="noreferrer"
                        title={
                          platform === "ANDROID" ? "Open on Google Play" : "Search on the App Store"
                        }
                        className="flex items-center gap-2 hover:text-accent"
                      >
                        <AppIcon
                          src={c.iconUrl}
                          className="h-6 w-6 rounded shrink-0 transition-transform duration-200 group-hover:scale-110"
                        />
                        {c.name}
                      </a>
                    </td>
                    {keywords.map((k) => {
                      const rank = latest.get(k.id);
                      if (!rank) {
                        return (
                          <td key={k.id} className="p-3 text-muted" title="Not scanned yet">
                            —
                          </td>
                        );
                      }
                      if (rank.position === null) {
                        const checked = new Date(rank.checkedAt).toLocaleDateString();
                        return (
                          <td
                            key={k.id}
                            className="p-3 text-muted"
                            title={`Checked ${checked} - not found in top results`}
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={k.id} className="p-3">
                          #{rank.position}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right">
                      <button
                        onClick={() => removeCompetitor(c.id)}
                        className="text-muted hover:text-red-500 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
