"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Users } from "lucide-react";
import AppSearchPicker, { SearchHit } from "./AppSearchPicker";
import AppIcon from "./AppIcon";

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

// Google Play URLs resolve directly from the package id we already store.
// Apple's product page URLs need the numeric trackId (not the bundleId this
// app is tracked by), which we don't have on hand here, so iOS falls back to
// an exact-name App Store search - same convention already used for
// per-keyword store links elsewhere in this app.
function competitorUrl(platform: "IOS" | "ANDROID", storeId: string, name: string): string {
  if (platform === "ANDROID") {
    return `https://play.google.com/store/apps/details?id=${encodeURIComponent(storeId)}`;
  }
  return `https://apps.apple.com/us/search?term=${encodeURIComponent(name)}`;
}

export default function CompetitorsSection({
  appId,
  platform,
  competitors,
  keywords,
}: {
  appId: string;
  platform: "IOS" | "ANDROID";
  competitors: CompetitorWithRanks[];
  keywords: { id: string; term: string }[];
}) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(hit: SearchHit) {
    setError(null);
    const res = await fetch(`/api/apps/${appId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, storeId: hit.storeId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add competitor");
      return;
    }
    setShowSearch(false);
    router.refresh();
  }

  async function removeCompetitor(competitorId: string) {
    await fetch(`/api/apps/${appId}/competitors/${competitorId}`, { method: "DELETE" });
    router.refresh();
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
          <AppSearchPicker platform={platform} allowPlatformChange={false} onSelect={handleSelect} />
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
                        href={competitorUrl(platform, c.storeId, c.name)}
                        target="_blank"
                        rel="noreferrer"
                        title={platform === "ANDROID" ? "Open on Google Play" : "Search on the App Store"}
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
                          <td key={k.id} className="p-3 text-muted" title={`Checked ${checked} - not found in top results`}>
                            —
                          </td>
                        );
                      }
                      return <td key={k.id} className="p-3">#{rank.position}</td>;
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
