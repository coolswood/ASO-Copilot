import Link from "next/link";
import { Gauge, LayoutGrid, Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import AppCard from "@/components/AppCard";

function scoreColors(score: number): { color: string; soft: string } {
  if (score >= 80) return { color: "var(--success)", soft: "var(--success-soft)" };
  if (score >= 60) return { color: "var(--warning)", soft: "var(--warning-soft)" };
  return { color: "var(--danger)", soft: "var(--danger-soft)" };
}

export default async function Home() {
  const apps = await prisma.app.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { keywords: true, competitors: true } },
      healthReports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const scores = apps
    .map((a) => a.healthReports[0]?.score)
    .filter((s): s is number => typeof s === "number");
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const totalKeywords = apps.reduce((sum, a) => sum + a._count.keywords, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="animate-fade-in-up flex flex-wrap items-end justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your apps</h1>
        <Link
          href="/apps/new"
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0"
        >
          + Add app
        </Link>
      </div>

      {apps.length > 0 && (
        <div className="animate-fade-in-up grid grid-cols-1 gap-3 mb-8 sm:grid-cols-3 [animation-delay:40ms]">
          <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-accent/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <LayoutGrid className="h-4 w-4 text-accent" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight tabular-nums">{apps.length}</div>
              <div className="text-xs text-muted">app{apps.length === 1 ? "" : "s"} tracked</div>
            </div>
          </div>
          <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-accent/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <Tags className="h-4 w-4 text-accent" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight tabular-nums">{totalKeywords}</div>
              <div className="text-xs text-muted">keywords tracked</div>
            </div>
          </div>
          <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-accent/40">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: avgScore !== null ? scoreColors(avgScore).soft : "var(--border)" }}
            >
              <Gauge className="h-4 w-4" style={{ color: avgScore !== null ? scoreColors(avgScore).color : "var(--muted)" }} />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight tabular-nums">
                {avgScore !== null ? avgScore : "—"}
              </div>
              <div className="text-xs text-muted">avg health score</div>
            </div>
          </div>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center text-muted [animation-delay:80ms]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border/50">
            <LayoutGrid className="h-6 w-6 text-muted" />
          </div>
          <div>
            No apps yet.{" "}
            <Link href="/apps/new" className="text-accent font-medium hover:underline">
              Add your first app
            </Link>{" "}
            to start tracking keyword ranks, competitors, and ASO health.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app, i) => (
            <div
              key={app.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <AppCard
                id={app.id}
                name={app.name}
                iconUrl={app.iconUrl}
                platform={app.platform}
                keywordCount={app._count.keywords}
                competitorCount={app._count.competitors}
                healthScore={app.healthReports[0]?.score ?? null}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
