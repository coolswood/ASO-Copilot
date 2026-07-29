"use client";

import { useEffect, useState } from "react";
import { Languages, RefreshCw } from "lucide-react";
import HealthGauge from "./HealthGauge";
import { healthScoreTier } from "@/lib/health";
import { IssueBadge, LOCALE_LABELS, type LocaleIssue } from "./localeShared";
import LocaleSuggestionModal from "./LocaleSuggestionModal";

export interface LocalizationRow {
  locale: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  titleLocalized: boolean;
  score: number;
  issues: LocaleIssue[];
  lastSyncedAt: string;
}

function LocaleCard({ row, onOpen }: { row: LocalizationRow; onOpen: () => void }) {
  const { label: tierLabel } = healthScoreTier(row.score);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="animate-fade-in-up rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-3 text-left transition-shadow hover:shadow-md hover:border-accent/50 cursor-pointer"
    >
      <div className="text-center">
        <div className="text-sm font-medium">{LOCALE_LABELS[row.locale] ?? row.locale}</div>
        <div className="text-xs text-muted">{row.locale}</div>
      </div>
      <HealthGauge score={row.score} size={76} />
      {row.issues.length === 0 ? (
        <div className="text-xs" style={{ color: "var(--success)" }}>
          Clean — no issues found
        </div>
      ) : (
        <div className="w-full space-y-1.5">
          {row.issues.map((issue, i) => (
            <IssueBadge key={i} issue={issue} />
          ))}
        </div>
      )}
      <div className="text-[11px] text-muted">{tierLabel}</div>
      <div className="text-[11px] text-accent">View & fix →</div>
    </button>
  );
}

export default function LocalizationHealthSection({ appId }: { appId: string }) {
  const [rows, setRows] = useState<LocalizationRow[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openLocale, setOpenLocale] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/apps/${appId}/localizations`)
      .then((res) => res.json())
      .then((data) => setRows(data.localizations ?? []))
      .catch(() => setError("Failed to load localizations"));
  }, [appId]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/localizations`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setRows(data.localizations ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const sorted = rows ? [...rows].sort((a, b) => a.score - b.score) : null;
  const withIssues = sorted?.filter((r) => r.issues.length > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-xl">
          Re-fetches the live storefront listing per locale and scores it independently - catches locales where the
          title never got translated, or where translated copy has leaked/broken text, even though the base health
          report above looks fine.
        </p>
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Scanning storefronts..." : sorted === null || sorted.length === 0 ? "Scan locales" : "Rescan locales"}
        </button>
      </div>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {sorted === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
            <Languages className="h-5 w-5 text-muted" />
          </div>
          <div className="text-sm text-muted">No locale scan yet. Click &quot;Scan locales&quot; to check every storefront.</div>
        </div>
      ) : (
        <>
          {withIssues > 0 && (
            <div className="animate-fade-in-up text-sm" style={{ color: "var(--danger)" }}>
              {withIssues} of {sorted.length} localized storefronts have an issue worth fixing.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sorted.map((row) => (
              <LocaleCard key={row.locale} row={row} onOpen={() => setOpenLocale(row.locale)} />
            ))}
          </div>
        </>
      )}

      {openLocale &&
        (() => {
          const row = rows?.find((r) => r.locale === openLocale);
          return row ? (
            <LocaleSuggestionModal appId={appId} row={row} onClose={() => setOpenLocale(null)} />
          ) : null;
        })()}
    </div>
  );
}
