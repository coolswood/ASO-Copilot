"use client";

import { useState } from "react";
import AppIcon from "./AppIcon";
import type { StorePlatform } from "@/lib/stores/types";

export interface SearchHit {
  storeId: string;
  name: string;
  iconUrl: string | null;
  developer: string | null;
}

export default function AppSearchPicker({
  platform,
  onSelect,
  allowPlatformChange = true,
}: {
  platform: StorePlatform;
  onSelect: (hit: SearchHit, platform: StorePlatform) => void | Promise<void>;
  allowPlatformChange?: boolean;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState(platform);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  async function search() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search?platform=${selectedPlatform}&term=${encodeURIComponent(term)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(hit: SearchHit) {
    setSelecting(hit.storeId);
    try {
      await onSelect(hit, selectedPlatform);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {allowPlatformChange && (
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as StorePlatform)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent"
          >
            <option value="IOS">App Store</option>
            <option value="ANDROID">Google Play</option>
          </select>
        )}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by app name..."
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors focus:border-accent"
        />
        <button
          onClick={search}
          disabled={loading}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {results.length > 0 && (
        <div className="animate-fade-in-up divide-y divide-border rounded-lg border border-border overflow-hidden">
          {results.map((hit, i) => (
            <div
              key={hit.storeId}
              className="animate-fade-in-up flex items-center gap-3 p-3 transition-colors hover:bg-background"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <AppIcon src={hit.iconUrl} className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{hit.name}</div>
                <div className="text-xs text-muted truncate">{hit.developer}</div>
              </div>
              <button
                onClick={() => handleSelect(hit)}
                disabled={selecting === hit.storeId}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-accent disabled:opacity-50"
              >
                {selecting === hit.storeId ? "Adding..." : "Add"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
