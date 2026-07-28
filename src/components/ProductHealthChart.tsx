"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import ChartTooltipShell from "./ChartTooltipShell";

interface ProductHealthPoint {
  date: string;
  dau: number | null;
  healthScore: number | null;
}

interface ChartPoint {
  xLabel: string;
  dateLabel: string;
  dau: number | null;
  healthScore: number | null;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <ChartTooltipShell>
      <div className="font-medium">{point.dateLabel}</div>
      <div className="mt-1.5 flex items-center justify-between gap-6">
        <span className="text-muted">Daily active users</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
          {point.dau ?? "—"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted">Health score</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--success)" }}>
          {point.healthScore ?? "—"}
        </span>
      </div>
    </ChartTooltipShell>
  );
}

export default function ProductHealthChart({ appId }: { appId: string }) {
  const [trend, setTrend] = useState<ProductHealthPoint[] | null | undefined>(undefined);

  useEffect(() => {
    function load() {
      fetch(`/api/apps/${appId}/product-health`)
        .then((res) => res.json())
        .then((data) => setTrend(data.trend))
        .catch(() => setTrend(null));
    }
    load();

    // AppTabs mounts every tab's content up front (just hides inactive ones),
    // so this chart fetches once on initial page load - typically before
    // PostHog gets connected in the Settings tab of the same page. Without
    // this, connecting only takes effect after a full page reload.
    function onPostHogStatusChange(e: Event) {
      if ((e as CustomEvent<{ appId: string }>).detail?.appId === appId) load();
    }
    window.addEventListener("posthog-status-change", onPostHogStatusChange);
    return () => window.removeEventListener("posthog-status-change", onPostHogStatusChange);
  }, [appId]);

  if (trend === undefined) {
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
        <div className="h-[220px] rounded-lg bg-border animate-pulse" />
      </div>
    );
  }

  if (trend === null) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
          <Activity className="h-5 w-5 text-muted" />
        </div>
        <div className="text-sm text-muted">
          Connect a PostHog project in Settings to see real usage next to your ASO health score.
        </div>
      </div>
    );
  }

  const data: ChartPoint[] = trend.map((p) => {
    const date = new Date(p.date);
    return {
      xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateLabel: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      dau: p.dau,
      healthScore: p.healthScore,
    };
  });

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Product health vs. ASO health</div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
            Daily active users
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
            Health score
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="xLabel"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            yAxisId="dau"
            allowDecimals={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="health"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            yAxisId="dau"
            type="monotone"
            dataKey="dau"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            yAxisId="health"
            type="monotone"
            dataKey="healthScore"
            stroke="var(--success)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
