"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, WandSparkles } from "lucide-react";
import { AI_LOCALES } from "@/lib/aiLocales";

interface CopySuggestion {
  field: "title" | "subtitle" | "description";
  current: string;
  suggestion: string;
  rationale: string;
}

type CopySuggestionSource = "openrouter" | "mcp";

const FIELD_LABELS: Record<CopySuggestion["field"], string> = {
  title: "Title",
  subtitle: "Subtitle",
  description: "Description",
};

const SOURCE_LABELS: Record<CopySuggestionSource, string> = {
  openrouter: "via OpenRouter",
  mcp: "via MCP",
};

function SuggestionCard({ s }: { s: CopySuggestion }) {
  const [copied, setCopied] = useState(false);
  const changed = s.suggestion.trim() !== s.current.trim();

  async function copy() {
    try {
      await navigator.clipboard.writeText(s.suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied - nothing to fall back to, button just won't flip to "Copied"
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{FIELD_LABELS[s.field]}</h4>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-card hover:border-accent"
        >
          {copied ? <Check className="h-3 w-3" style={{ color: "var(--success)" }} /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {changed && s.current && (
        <div className="text-xs text-muted line-through decoration-red-500/50 whitespace-pre-wrap">{s.current}</div>
      )}
      <div className="text-sm whitespace-pre-wrap">{s.suggestion}</div>
      <p className="text-xs text-accent">{s.rationale}</p>
    </div>
  );
}

function LocaleResults({
  label,
  suggestions,
  source,
  error,
  pending,
}: {
  label: string;
  suggestions: CopySuggestion[] | null;
  source: CopySuggestionSource | null;
  error: string | null;
  pending: boolean;
}) {
  return (
    <div className="animate-fade-in-up space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
        {label}
        {source && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted">
            {SOURCE_LABELS[source]}
          </span>
        )}
      </h3>
      {error && <div className="text-sm text-red-500">{error}</div>}
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
      {!pending && !suggestions && !error && (
        <div className="text-xs text-muted">
          Not generated yet - hit &quot;Get AI suggestions&quot; above, or have an MCP client save some via
          save_copy_suggestions.
        </div>
      )}
    </div>
  );
}

export default function AICopySuggestions({ appId }: { appId: string }) {
  // Multi-select: several languages can be toggled on and viewed side by
  // side at once, independent of which ones have actually been generated -
  // generation always covers all locales in one click regardless of this.
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set([AI_LOCALES[0].code]));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [byLocale, setByLocale] = useState<Record<string, CopySuggestion[]>>({});
  const [sourceByLocale, setSourceByLocale] = useState<Record<string, CopySuggestionSource>>({});
  const [errorByLocale, setErrorByLocale] = useState<Record<string, string>>({});
  const [notConfigured, setNotConfigured] = useState(false);

  // Loads whatever's already saved (written by a prior OpenRouter run or by
  // an MCP client's save_copy_suggestions - no key needed for that path) so
  // the panel isn't empty just because nobody's clicked the button this
  // session.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      AI_LOCALES.map(async (l) => {
        const res = await fetch(`/api/apps/${appId}/ai-suggestions?locale=${l.code}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.suggestions ? { code: l.code, suggestions: data.suggestions, source: data.source } : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const loadedSuggestions: Record<string, CopySuggestion[]> = {};
      const loadedSources: Record<string, CopySuggestionSource> = {};
      for (const r of results) {
        if (!r) continue;
        loadedSuggestions[r.code] = r.suggestions;
        loadedSources[r.code] = r.source;
      }
      if (Object.keys(loadedSuggestions).length > 0) {
        setByLocale((prev) => ({ ...loadedSuggestions, ...prev }));
        setSourceByLocale((prev) => ({ ...loadedSources, ...prev }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appId]);

  function toggleLocale(code: string) {
    setSelectedLocales((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function generateAll() {
    setNotConfigured(false);
    setErrorByLocale({});
    setPending(new Set(AI_LOCALES.map((l) => l.code)));

    await Promise.all(
      AI_LOCALES.map(async (l) => {
        try {
          const res = await fetch(`/api/apps/${appId}/ai-suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: l.code }),
          });
          const data = await res.json();
          if (res.status === 501) {
            setNotConfigured(true);
            return;
          }
          if (!res.ok) throw new Error(data.error ?? "Failed to generate suggestions");
          setByLocale((prev) => ({ ...prev, [l.code]: data.suggestions }));
          setSourceByLocale((prev) => ({ ...prev, [l.code]: "openrouter" }));
        } catch (e) {
          setErrorByLocale((prev) => ({ ...prev, [l.code]: (e as Error).message }));
        } finally {
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(l.code);
            return next;
          });
        }
      }),
    );
  }

  const generating = pending.size > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
          {AI_LOCALES.map((l) => {
            const active = selectedLocales.has(l.code);
            return (
              <button
                key={l.code}
                onClick={() => toggleLocale(l.code)}
                aria-pressed={active}
                className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {l.code.toUpperCase()}
                {pending.has(l.code) ? (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                ) : (
                  errorByLocale[l.code] && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--danger)" }}
                    />
                  )
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={generateAll}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          {generating ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <WandSparkles className="h-3.5 w-3.5" />}
          {generating ? "Writing all languages..." : Object.keys(byLocale).length ? "Regenerate all" : "Get AI suggestions"}
        </button>
        <span className="text-xs text-muted">
          Generates all {AI_LOCALES.length} languages at once via OpenRouter. Toggle languages above to compare
          several side by side.
        </span>
      </div>

      {notConfigured && (
        <div className="animate-fade-in-up rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Set <code className="rounded bg-border/50 px-1 py-0.5 text-xs">OPENROUTER_API_KEY</code> in the server&apos;s{" "}
          <code className="rounded bg-border/50 px-1 py-0.5 text-xs">.env</code> to generate from here - get a key at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            openrouter.ai/keys
          </a>
          . Optionally set <code className="rounded bg-border/50 px-1 py-0.5 text-xs">OPENROUTER_MODEL</code> to pick
          a different model. No key? An MCP client can compose and save suggestions instead - see
          prepare_copy_localization_brief / save_copy_suggestions.
        </div>
      )}

      {selectedLocales.size === 0 && (
        <div className="text-sm text-muted">Select at least one language above to view its suggestions.</div>
      )}

      {AI_LOCALES.filter((l) => selectedLocales.has(l.code)).map((l) => (
        <LocaleResults
          key={l.code}
          label={l.label}
          suggestions={byLocale[l.code] ?? null}
          source={sourceByLocale[l.code] ?? null}
          error={errorByLocale[l.code] ?? null}
          pending={pending.has(l.code)}
        />
      ))}
    </div>
  );
}
