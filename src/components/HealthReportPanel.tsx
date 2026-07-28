import type { ComponentType, CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Heading,
  Image as ImageIcon,
  Info,
  RefreshCw,
  Star,
  Tags,
  Text,
} from "lucide-react";
import HealthGauge from "./HealthGauge";
import type { HealthBreakdownItem, HealthSuggestion } from "@/lib/health";

function barColor(ratio: number): string {
  if (ratio >= 0.8) return "var(--success)";
  if (ratio >= 0.4) return "var(--warning)";
  return "var(--danger)";
}

const BREAKDOWN_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  title: Heading,
  subtitle: Text,
  screenshots: ImageIcon,
  description: Text,
  keywordCoverage: Tags,
  ratings: Star,
  freshness: RefreshCw,
};

const SUGGESTION_STYLES: Record<
  HealthSuggestion["kind"],
  { icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string }
> = {
  info: { icon: Info, color: "var(--accent)" },
  warning: { icon: AlertTriangle, color: "var(--warning)" },
  critical: { icon: AlertCircle, color: "var(--danger)" },
};

export default function HealthReportPanel({
  score,
  breakdown,
  suggestions,
}: {
  score: number;
  breakdown: HealthBreakdownItem[];
  suggestions: HealthSuggestion[];
}) {
  const strong = breakdown.filter((b) => b.max > 0 && b.score / b.max >= 0.8).length;
  const okay = breakdown.filter((b) => b.max > 0 && b.score / b.max >= 0.4 && b.score / b.max < 0.8).length;
  const weak = breakdown.length - strong - okay;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col-reverse md:flex-row gap-8">
        <div className="flex-1 space-y-4">
          {breakdown.map((item, i) => {
            const ratio = item.max > 0 ? item.score / item.max : 0;
            const Icon = BREAKDOWN_ICONS[item.key];
            return (
              <div key={item.key} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {Icon && <Icon className="h-3.5 w-3.5 text-muted" />}
                    {item.label}
                  </span>
                  <span className="text-muted">
                    {item.score}/{item.max}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${ratio * 100}%`, background: barColor(ratio) }}
                  />
                </div>
                <div className="text-xs text-muted mt-1">{item.message}</div>
              </div>
            );
          })}

          {suggestions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="text-sm font-semibold mb-3">Suggestions</div>
              <div className="space-y-3">
                {suggestions.map((s, i) => {
                  const { icon: Icon, color } = SUGGESTION_STYLES[s.kind];
                  return (
                    <div
                      key={s.title}
                      className="animate-fade-in-up flex gap-2.5 rounded-lg border-l-2 bg-background/50 p-3 text-sm"
                      style={{ animationDelay: `${i * 50}ms`, borderColor: color }}
                    >
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color }} />
                      <div>
                        <div className="font-medium" style={{ color }}>
                          {s.title}
                        </div>
                        <div className="text-muted mt-0.5">{s.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="md:pl-8 md:border-l md:border-border shrink-0 md:w-44">
          <div className="sticky top-24 flex flex-col items-center gap-6">
            <HealthGauge score={score} size={88} />

            <div className="w-full space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                  Strong
                </span>
                <span className="font-medium tabular-nums">{strong}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warning)" }} />
                  Needs work
                </span>
                <span className="font-medium tabular-nums">{okay}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger)" }} />
                  Weak
                </span>
                <span className="font-medium tabular-nums">{weak}</span>
              </div>
              {suggestions.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border text-muted">
                  {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"} to review
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
