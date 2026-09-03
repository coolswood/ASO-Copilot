import { useState } from "react";
import { Link } from "react-router";
import { Pin } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import AppIcon from "./AppIcon";
import { healthScoreTier } from "@/lib/health";
import type { StorePlatform } from "@/lib/stores/types";

function MiniScoreRing({ score }: { score: number }) {
  const size = 40;
  const strokeWidth = 4;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = healthScoreTier(score).color;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          style={
            {
              "--circumference": circumference,
              "--offset": offset,
              animation: "gauge-fill 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
        {score}
      </div>
    </div>
  );
}

export default function AppCard({
  id,
  name,
  iconUrl,
  platform,
  keywordCount,
  competitorCount,
  healthScore,
  pinned,
  onChanged,
}: {
  id: string;
  name: string;
  iconUrl: string | null;
  platform: StorePlatform;
  keywordCount: number;
  competitorCount: number;
  healthScore: number | null;
  pinned: boolean;
  /** Re-fetches the dashboard list after a successful pin toggle (was
   * router.refresh() against the server component in the Next.js app). */
  onChanged?: () => void;
}) {
  const [isPinned, setIsPinned] = useState(pinned);
  const [toggling, setToggling] = useState(false);

  async function togglePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    const next = !isPinned;
    setIsPinned(next);
    try {
      const res = await fetch(`/api/apps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) throw new Error("Failed to update pin");
      onChanged?.();
    } catch {
      setIsPinned(!next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Link
      to={`/apps/${id}`}
      className="card-hover group relative rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-accent hover:-translate-y-1"
    >
      <button
        type="button"
        onClick={togglePin}
        disabled={toggling}
        aria-pressed={isPinned}
        title={isPinned ? "Unpin app" : "Pin app to top"}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted opacity-0 transition-opacity hover:bg-border/50 hover:text-foreground group-hover:opacity-100 disabled:opacity-50 data-[pinned=true]:opacity-100"
        data-pinned={isPinned}
      >
        <Pin
          className={`h-4 w-4 ${isPinned ? "rotate-0" : "-rotate-45"}`}
          style={isPinned ? { color: "var(--accent)" } : undefined}
          fill={isPinned ? "var(--accent)" : "none"}
        />
      </button>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AppIcon
            src={iconUrl}
            className="h-12 w-12 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          <div className="min-w-0">
            <div className="font-medium truncate">{name}</div>
            <div className="flex items-center gap-1 text-xs text-muted">
              {platform === "IOS" ? (
                <SiAppstore className="h-3 w-3 shrink-0" />
              ) : (
                <SiGoogleplay className="h-3 w-3 shrink-0" />
              )}
              {platform === "IOS" ? "App Store" : "Google Play"}
            </div>
          </div>
        </div>
        {healthScore !== null && <MiniScoreRing score={healthScore} />}
      </div>

      <div className="flex gap-4 text-sm text-muted">
        <span>{keywordCount} keywords</span>
        <span>{competitorCount} competitors</span>
      </div>
    </Link>
  );
}
