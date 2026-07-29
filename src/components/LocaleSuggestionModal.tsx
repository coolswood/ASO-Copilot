"use client";

import { useEffect, useState } from "react";
import { X, WandSparkles, Sparkles, Trash2 } from "lucide-react";
import HealthGauge from "./HealthGauge";
import { healthScoreTier } from "@/lib/health";
import { IssueBadge, LOCALE_LABELS } from "./localeShared";
import { AI_LOCALES } from "@/lib/aiLocales";
import { SuggestionCard, SOURCE_LABELS, type CopySuggestion, type CopySuggestionSource } from "./AICopySuggestions";
import type { LocalizationRow } from "./LocalizationHealthSection";

const FIELD_LABELS: Record<"title" | "subtitle" | "description", string> = {
  title: "Title",
  subtitle: "Subtitle",
  description: "Description",
};

export default function LocaleSuggestionModal({
  appId,
  row,
  onClose,
}: {
  appId: string;
  row: LocalizationRow;
  onClose: () => void;
}) {
  const { label: tierLabel } = healthScoreTier(row.score);
  const aiSupported = AI_LOCALES.some((l) => l.code === row.locale);

  const [suggestions, setSuggestions] = useState<CopySuggestion[] | null>(null);
  const [source, setSource] = useState<CopySuggestionSource | null>(null);
  const [discovered, setDiscovered] = useState<string[] | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loaded, setLoaded] = useState(() => !aiSupported);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!aiSupported) return;
    let cancelled = false;
    fetch(`/api/apps/${appId}/ai-suggestions?locale=${row.locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.suggestions) return;
        setSuggestions(data.suggestions);
        setSource(data.source);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appId, row.locale, aiSupported]);

  async function generate() {
    setPending(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch(`/api/apps/${appId}/ai-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: row.locale }),
      });
      const data = await res.json();
      if (res.status === 501) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to generate suggestions");
      setSuggestions(data.suggestions);
      setSource("openrouter");
      if (data.discoveredKeywords?.length) setDiscovered(data.discoveredKeywords);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function dismiss() {
    setSuggestions(null);
    setSource(null);
    setDiscovered(undefined);
    try {
      await fetch(`/api/apps/${appId}/ai-suggestions?locale=${row.locale}`, { method: "DELETE" });
    } catch {
      // best-effort - a failed delete just means it reappears next reload
    }
  }

  const currentCopy: { field: keyof typeof FIELD_LABELS; value: string | null }[] = [
    { field: "title", value: row.title },
    { field: "subtitle", value: row.subtitle },
    { field: "description", value: row.description },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh] animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <HealthGauge score={row.score} size={56} />
            <div>
              <h2 className="text-lg font-semibold">{LOCALE_LABELS[row.locale] ?? row.locale}</h2>
              <div className="text-xs text-muted">
                {row.locale} · {tierLabel}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-border/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {row.issues.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {row.issues.map((issue, i) => (
              <IssueBadge key={i} issue={issue} />
            ))}
          </div>
        )}

        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted">Current live copy</h3>
          {currentCopy.map(({ field, value }) => (
            <div key={field} className="rounded-lg border border-border bg-background p-3">
              <div className="text-xs font-medium text-muted">{FIELD_LABELS[field]}</div>
              <div className="mt-1 text-sm whitespace-pre-wrap">{value || <span className="text-muted italic">— empty —</span>}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
              AI recommendations
              {source && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted">
                  {SOURCE_LABELS[source]}
                </span>
              )}
            </h3>
            {aiSupported && (
              <div className="flex items-center gap-2">
                {suggestions && (
                  <button
                    onClick={dismiss}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-normal text-muted hover:text-foreground hover:bg-border/50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Dismiss
                  </button>
                )}
                <button
                  onClick={generate}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  {pending ? <Sparkles className="h-3 w-3 animate-pulse" /> : <WandSparkles className="h-3 w-3" />}
                  {pending ? "Writing..." : suggestions ? "Regenerate" : "Get AI suggestions"}
                </button>
              </div>
            )}
          </div>

          {!aiSupported && (
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">
              AI rewrite suggestions aren&apos;t available yet for this locale. Supported:{" "}
              {AI_LOCALES.map((l) => l.code).join(", ")}. Use the current copy above to fix the issues manually in the
              meantime.
            </div>
          )}

          {notConfigured && (
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">
              Set <code className="rounded bg-border/50 px-1 py-0.5">OPENROUTER_API_KEY</code> in the server&apos;s{" "}
              <code className="rounded bg-border/50 px-1 py-0.5">.env</code> to generate from here, or have an MCP
              client save suggestions via save_copy_suggestions.
            </div>
          )}

          {error && <div className="text-sm text-red-500">{error}</div>}

          {discovered && discovered.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Real local search phrases used:</span>
              {discovered.map((phrase) => (
                <span key={phrase} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                  {phrase}
                </span>
              ))}
            </div>
          )}

          {pending && (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg border border-border bg-background animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}

          {!pending && suggestions && (
            <div className="grid gap-3 sm:grid-cols-3">
              {suggestions.map((s) => (
                <SuggestionCard key={s.field} s={s} />
              ))}
            </div>
          )}

          {!pending && aiSupported && loaded && !suggestions && !error && (
            <div className="text-xs text-muted">
              Not generated yet for this locale — hit &quot;Get AI suggestions&quot; above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
