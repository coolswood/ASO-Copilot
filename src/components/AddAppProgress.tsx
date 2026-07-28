"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import AppIcon from "./AppIcon";
import type { SearchHit } from "./AppSearchPicker";
import { healthScoreTier } from "@/lib/health";
import type { StorePlatform } from "@/lib/stores/types";

type StageEvent =
  | { stage: "listing"; name: string; iconUrl: string | null; developer: string | null; subtitle: string | null; category: string | null }
  | { stage: "app_created"; appId: string }
  | { stage: "keyword"; term: string; rank: number | null }
  | { stage: "competitor"; name: string; iconUrl: string | null }
  | { stage: "health"; score: number }
  | { stage: "done"; appId: string }
  | { stage: "error"; message: string };

const STAGE_ORDER = ["listing", "keyword", "competitor", "health", "done"];

const STEPS = [
  { key: "listing", label: "Fetching your store listing" },
  { key: "keyword", label: "Auto-detecting keywords" },
  { key: "competitor", label: "Finding competitors" },
  { key: "health", label: "Computing health score" },
] as const;

function StepStatus({ status }: { status: "pending" | "active" | "done" }) {
  if (status === "done") return <Check className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />;
  if (status === "active") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />;
  return <span className="h-4 w-4 shrink-0 rounded-full border border-border" />;
}

export default function AddAppProgress({ hit, platform }: { hit: SearchHit; platform: StorePlatform }) {
  const router = useRouter();
  const [stageIdx, setStageIdx] = useState(0);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<{ term: string; rank: number | null }[]>([]);
  const [competitors, setCompetitors] = useState<{ name: string; iconUrl: string | null }[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    function handleEvent(event: StageEvent) {
      if (event.stage === "error") {
        setError(event.message);
        return;
      }
      const idx = STAGE_ORDER.indexOf(event.stage);
      if (idx !== -1) setStageIdx((prev) => Math.max(prev, idx));
      if (event.stage === "listing") setSubtitle(event.subtitle);
      if (event.stage === "keyword") setKeywords((prev) => [...prev, { term: event.term, rank: event.rank }]);
      if (event.stage === "competitor") {
        setCompetitors((prev) => [...prev, { name: event.name, iconUrl: event.iconUrl }]);
      }
      if (event.stage === "health") setHealthScore(event.score);
      if (event.stage === "done") {
        setAppId(event.appId);
        setFinished(true);
      }
    }

    async function run() {
      try {
        const res = await fetch("/api/apps/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, storeId: hit.storeId }),
        });
        if (!res.body) throw new Error("No response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            try {
              handleEvent(JSON.parse(line.slice(5).trim()));
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finished && appId) {
      const t = setTimeout(() => router.push(`/apps/${appId}`), 900);
      return () => clearTimeout(t);
    }
  }, [finished, appId, router]);

  function statusFor(idx: number): "pending" | "active" | "done" {
    if (idx < stageIdx || finished) return "done";
    if (idx === stageIdx) return "active";
    return "pending";
  }

  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <AppIcon src={hit.iconUrl} className="h-12 w-12 rounded-xl shrink-0" />
        <div className="min-w-0">
          <div className="font-medium truncate">{hit.name}</div>
          <div className="text-xs text-muted truncate">{subtitle ?? hit.developer}</div>
        </div>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const status = statusFor(i);
          return (
            <div
              key={step.key}
              className={`animate-fade-in-up rounded-xl border border-border bg-card p-4 transition-opacity duration-300 ${
                status === "pending" ? "opacity-40" : "opacity-100"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <StepStatus status={status} />
                {step.label}
                {step.key === "keyword" && keywords.length > 0 && (
                  <span className="font-normal text-muted">({keywords.length} found)</span>
                )}
                {step.key === "competitor" && competitors.length > 0 && (
                  <span className="font-normal text-muted">({competitors.length} found)</span>
                )}
              </div>

              {step.key === "keyword" && keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {keywords.map((k, idx) => (
                    <span
                      key={k.term}
                      className="animate-fade-in-up inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {k.term}
                      {k.rank !== null && <span className="font-medium" style={{ color: "var(--success)" }}>#{k.rank}</span>}
                    </span>
                  ))}
                </div>
              )}

              {step.key === "competitor" && competitors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {competitors.map((c, idx) => (
                    <span
                      key={c.name}
                      className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-2.5 text-xs"
                      style={{ animationDelay: `${idx * 70}ms` }}
                    >
                      <AppIcon src={c.iconUrl} className="h-4 w-4 rounded-full shrink-0" />
                      {c.name}
                    </span>
                  ))}
                </div>
              )}

              {step.key === "health" && healthScore !== null && (
                <div className="animate-fade-in-up mt-2 text-sm">
                  Health score:{" "}
                  <span className="font-semibold" style={{ color: healthScoreTier(healthScore).color }}>
                    {healthScore}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {finished && appId && (
        <div className="animate-fade-in-up flex items-center justify-between rounded-xl border border-border p-4" style={{ background: "var(--success-soft)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
            All done! Taking you to your dashboard...
          </span>
          <Link href={`/apps/${appId}`} className="text-sm font-medium text-accent hover:underline">
            View now →
          </Link>
        </div>
      )}
    </div>
  );
}
