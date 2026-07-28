"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import AppIcon from "./AppIcon";
import type { StorePlatform } from "@/lib/stores/types";

export default function AppHeader({
  id,
  name,
  iconUrl,
  platform,
  developer,
  url,
  rating,
  ratingCount,
  version,
}: {
  id: string;
  name: string;
  iconUrl: string | null;
  platform: StorePlatform;
  developer: string | null;
  url: string | null;
  rating: number | null;
  ratingCount: number | null;
  version: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      await fetch(`/api/apps/${id}/sync`, { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-4">
        <AppIcon src={iconUrl} className="h-16 w-16 rounded-2xl shadow-sm shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{name}</h1>
          <div className="text-sm text-muted truncate">
            {developer} · {platform === "IOS" ? "App Store" : "Google Play"}
            {version && ` · v${version}`}
          </div>
          {rating !== null && (
            <div className="text-sm text-muted mt-0.5">
              ★ {rating.toFixed(1)} ({ratingCount?.toLocaleString()} ratings)
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-card hover:border-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View listing
          </a>
        )}
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-card hover:border-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </div>
    </div>
  );
}
