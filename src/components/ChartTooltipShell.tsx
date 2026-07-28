import type { ReactNode } from "react";

/** Shared visual shell for Recharts custom tooltips (RankHistoryChart,
 * ProductHealthChart, KeywordsOverviewChart) - each chart still owns its own
 * row content/data shape, only the container styling was identical. */
export default function ChartTooltipShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg ${className}`.trim()}>
      {children}
    </div>
  );
}
