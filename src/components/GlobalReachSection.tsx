"use client";

import { useEffect, useState } from "react";
import { Globe, MapPinOff } from "lucide-react";
import WorldMap from "./WorldMap";

interface CountryResult {
  country: string;
  position: number | null;
}

/** Keyed by keywordId from the parent so switching keywords fully remounts
 * this (fresh `results: null` "loading" state) instead of needing to reset
 * state imperatively inside an effect. */
function KeywordGlobalMap({ appId, keywordId }: { appId: string; keywordId: string }) {
  const [results, setResults] = useState<CountryResult[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/apps/${appId}/keywords/${keywordId}/global-scan`)
      .then((res) => res.json())
      .then((data) => setResults(data.results ?? []))
      .catch(() => setError("Failed to load cached scan"));
  }, [appId, keywordId]);

  async function scanCountries() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords/${keywordId}/global-scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResults(data.results ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  const showSkeleton = results === null || scanning;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          onClick={scanCountries}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          <Globe className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning countries..." : "Scan countries"}
        </button>
        <p className="text-xs text-muted">
          Checks the app&apos;s live rank for this keyword across ~40 major App Store / Google Play storefronts.
        </p>
      </div>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {showSkeleton ? (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
          <div className="h-[260px] rounded-lg bg-border animate-pulse" />
        </div>
      ) : (
        <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6">
          <WorldMap results={results} />
        </div>
      )}
    </div>
  );
}

export default function GlobalReachSection({
  appId,
  keywords,
}: {
  appId: string;
  keywords: { id: string; term: string }[];
}) {
  const [keywordId, setKeywordId] = useState(keywords[0]?.id ?? "");

  if (keywords.length === 0) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
          <MapPinOff className="h-5 w-5 text-muted" />
        </div>
        <div className="text-sm text-muted">Track a keyword first to scan its rank across countries.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <select
        value={keywordId}
        onChange={(e) => setKeywordId(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent"
      >
        {keywords.map((k) => (
          <option key={k.id} value={k.id}>
            {k.term}
          </option>
        ))}
      </select>
      <KeywordGlobalMap key={keywordId} appId={appId} keywordId={keywordId} />
    </div>
  );
}
