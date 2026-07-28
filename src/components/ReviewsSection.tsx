"use client";

import { useEffect, useState } from "react";
import { Lightbulb, MessageSquareOff, RefreshCw, Star } from "lucide-react";
import MetricBar from "./MetricBar";

interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

interface ReviewTheme {
  term: string;
  count: number;
}

interface ReviewSample {
  rating: number | null;
  title: string | null;
  text: string | null;
  authorName: string | null;
  reviewedAt: string | Date | null;
}

interface ReviewAnalysis {
  totalReviews: number;
  averageRating: number | null;
  ratingDistribution: RatingDistribution;
  positiveThemes: ReviewTheme[];
  negativeThemes: ReviewTheme[];
  recentPositive: ReviewSample[];
  recentNegative: ReviewSample[];
}

function Stars({ rating }: { rating: number | null }) {
  const n = Math.round(rating ?? 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-warning">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3 w-3" fill={i < n ? "currentColor" : "none"} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function DistributionBar({ distribution, total }: { distribution: RatingDistribution; total: number }) {
  return (
    <div className="space-y-1.5">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const count = distribution[star];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 shrink-0 text-muted tabular-nums">{star}</span>
            <Star className="h-3 w-3 shrink-0 text-warning" fill="currentColor" strokeWidth={0} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-warning transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-muted tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ThemeList({ themes, tone }: { themes: ReviewTheme[]; tone: "positive" | "negative" }) {
  if (themes.length === 0) {
    return <div className="text-xs text-muted">Not enough reviews yet to find a pattern.</div>;
  }
  const color = tone === "positive" ? "var(--success)" : "var(--danger)";
  const soft = tone === "positive" ? "var(--success-soft)" : "var(--danger-soft)";
  return (
    <div className="flex flex-wrap gap-1.5">
      {themes.map((t) => (
        <span
          key={t.term}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ color, background: soft }}
        >
          {t.term}
          <span className="opacity-70">×{t.count}</span>
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewSample }) {
  const date = review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString() : null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40">
      <div className="flex items-center justify-between gap-2 mb-1">
        <Stars rating={review.rating} />
        {date && <span className="text-xs text-muted">{date}</span>}
      </div>
      {review.title && <div className="text-sm font-medium mb-0.5 line-clamp-1">{review.title}</div>}
      {review.text && <p className="text-xs text-muted line-clamp-3">{review.text}</p>}
      {review.authorName && <div className="mt-1.5 text-xs text-muted">— {review.authorName}</div>}
    </div>
  );
}

interface KeywordGap {
  term: string;
  mentions: number;
  volume: number;
  difficulty: number;
}

function KeywordGapsPanel({ appId }: { appId: string }) {
  const [gaps, setGaps] = useState<KeywordGap[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function findGaps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/reviews/keyword-gaps`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to analyze reviews");
      setGaps(data.gaps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function track(term: string) {
    setTracked((prev) => new Set(prev).add(term));
    try {
      const res = await fetch(`/api/apps/${appId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTracked((prev) => {
        const next = new Set(prev);
        next.delete(term);
        return next;
      });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
          Keyword opportunities from reviews
        </h3>
        <button
          onClick={findGaps}
          disabled={loading}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-background hover:border-accent disabled:opacity-50"
        >
          {loading ? "Analyzing..." : gaps === null ? "Find gaps" : "Refresh"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Words real users repeat in reviews that aren&apos;t among your tracked keywords yet.
      </p>

      {error && <div className="text-xs text-red-500">{error}</div>}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-border animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      {!loading && gaps !== null && (
        gaps.length === 0 ? (
          <div className="text-xs text-muted">No untracked keyword gaps found in your reviews right now.</div>
        ) : (
          <div className="space-y-1.5">
            {gaps.map((g) => (
              <div
                key={g.term}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-accent/40"
              >
                <span className="font-medium">{g.term}</span>
                <span className="text-xs text-muted">mentioned in {g.mentions} reviews</span>
                <div className="ml-auto flex items-center gap-4">
                  <MetricBar value={g.volume} />
                  <MetricBar value={g.difficulty} inverse />
                  <button
                    onClick={() => track(g.term)}
                    disabled={tracked.has(g.term)}
                    className="shrink-0 rounded-lg bg-accent text-accent-foreground px-2.5 py-1 text-xs font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                  >
                    {tracked.has(g.term) ? "Tracked" : "+ Track"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function ReviewsSection({ appId }: { appId: string }) {
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/apps/${appId}/reviews`)
      .then((res) => res.json())
      .then((data) => setAnalysis(data.analysis ?? null))
      .catch(() => setError("Failed to load reviews"));
  }, [appId]);

  async function syncReviews() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/reviews`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setAnalysis(data.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={syncReviews}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing reviews..." : "Sync reviews"}
      </button>

      {error && <div className="text-sm text-red-500 animate-fade-in-up">{error}</div>}

      {analysis === null ? (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
          <div className="h-32 rounded-lg bg-border animate-pulse" />
        </div>
      ) : analysis.totalReviews === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
            <MessageSquareOff className="h-5 w-5 text-muted" />
          </div>
          <div className="text-sm text-muted">No reviews synced yet. Click &quot;Sync reviews&quot; to pull the latest ones.</div>
        </div>
      ) : (
        <div className="animate-fade-in-up space-y-6">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col items-center justify-center gap-1 sm:pr-6 sm:border-r sm:border-border">
              <div className="text-3xl font-semibold tabular-nums">{analysis.averageRating ?? "—"}</div>
              <Stars rating={analysis.averageRating} />
              <div className="text-xs text-muted">{analysis.totalReviews} reviews</div>
            </div>
            <DistributionBar distribution={analysis.ratingDistribution} total={analysis.totalReviews} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-sm font-medium">Common praise</h3>
              <ThemeList themes={analysis.positiveThemes} tone="positive" />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-sm font-medium">Common complaints</h3>
              <ThemeList themes={analysis.negativeThemes} tone="negative" />
            </div>
          </div>

          <KeywordGapsPanel appId={appId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted">Recent positive</h3>
              {analysis.recentPositive.length === 0 ? (
                <div className="text-xs text-muted">None yet.</div>
              ) : (
                <div className="space-y-2">
                  {analysis.recentPositive.map((r, i) => (
                    <ReviewCard key={i} review={r} />
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted">Recent negative</h3>
              {analysis.recentNegative.length === 0 ? (
                <div className="text-xs text-muted">None yet.</div>
              ) : (
                <div className="space-y-2">
                  {analysis.recentNegative.map((r, i) => (
                    <ReviewCard key={i} review={r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
