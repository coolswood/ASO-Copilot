"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Languages, RefreshCw, ShieldAlert } from "lucide-react";
import HealthGauge from "./HealthGauge";
import { healthScoreTier } from "@/lib/health";

interface LocaleIssue {
  type: "title_not_localized" | "foreign_script" | "meta_leak" | "citation_artifact";
  field: "title" | "subtitle" | "description";
  message: string;
  snippet?: string;
}

interface LocalizationRow {
  locale: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  titleLocalized: boolean;
  score: number;
  issues: LocaleIssue[];
  lastSyncedAt: string;
}

// Mirrors src/lib/localeCandidates.ts labels - duplicated here (client
// component) rather than importing, since that module also pulls in
// server-only fetch/scoring code we don't want in the client bundle.
const LOCALE_LABELS: Record<string, string> = {
  en: "English (US)",
  es: "Spanish",
  de: "German",
  fr: "French",
  pt: "Portuguese (Brazil)",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  tr: "Turkish",
  id: "Indonesian",
  vi: "Vietnamese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Chinese (Simplified)",
  ar: "Arabic",
  hi: "Hindi",
  th: "Thai",
};

const ISSUE_LABELS: Record<LocaleIssue["type"], string> = {
  title_not_localized: "Title not translated",
  foreign_script: "Leaked foreign-script text",
  meta_leak: "Leftover AI-generation note",
  citation_artifact: "Stray citation artifact",
};

function IssueBadge({ issue }: { issue: LocaleIssue }) {
  const Icon = issue.type === "title_not_localized" ? AlertTriangle : ShieldAlert;
  return (
    <div
      className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs"
      style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
      title={issue.snippet ?? issue.message}
    >
      <Icon className="h-3 w-3 shrink-0 mt-0.5" />
      <span>
        {ISSUE_LABELS[issue.type]}
        <span className="opacity-70"> · {issue.field}</span>
      </span>
    </div>
  );
}

function LocaleCard({ row }: { row: LocalizationRow }) {
  const { label: tierLabel } = healthScoreTier(row.score);
  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-3">
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
    </div>
  );
}

export default function LocalizationHealthSection({ appId }: { appId: string }) {
  const [rows, setRows] = useState<LocalizationRow[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <LocaleCard key={row.locale} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
