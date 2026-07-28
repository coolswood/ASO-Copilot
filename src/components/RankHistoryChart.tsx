"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RankPoint {
  position: number | null;
  checkedAt: string | Date;
}

interface ChartPoint {
  xLabel: string;
  dateLabel: string;
  position: number | null;
  change: number | null;
}

const RANGES = [7, 30] as const;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{point.dateLabel}</div>
      <div className="mt-1.5 flex items-center justify-between gap-6">
        <span className="text-muted">Rank</span>
        <span className="font-semibold tabular-nums">
          {point.position !== null ? `#${point.position}` : "Not ranked"}
        </span>
      </div>
      {point.change !== null && point.change !== 0 && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted">Change</span>
          <span
            className="font-medium tabular-nums"
            style={{ color: point.change > 0 ? "var(--success)" : "var(--danger)" }}
          >
            {point.change > 0 ? `+${point.change}` : point.change}
          </span>
        </div>
      )}
    </div>
  );
}

export default function RankHistoryChart({ ranks }: { ranks: RankPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);

  // ranks arrives newest-first (matches the table); the chart reads
  // left-to-right chronologically.
  const chronological = useMemo(() => [...ranks].reverse(), [ranks]);
  const sliced = useMemo(() => chronological.slice(-range), [chronological, range]);

  const data = useMemo<ChartPoint[]>(
    () =>
      sliced.map((r, i) => {
        const prev = sliced[i - 1];
        const change = r.position !== null && prev?.position != null ? prev.position - r.position : null;
        const date = new Date(r.checkedAt);
        return {
          xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          dateLabel: date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          position: r.position,
          change,
        };
      }),
    [sliced],
  );

  const knownPositions = data.map((d) => d.position).filter((p): p is number => p !== null);

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Rank history</div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {knownPositions.length < 2 ? (
        <div className="py-10 text-center text-sm text-muted">Not enough history yet.</div>
      ) : (
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
              reversed
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
              domain={[
                (min: number) => Math.max(1, Math.floor(min) - 1),
                (max: number) => Math.ceil(max) + 1,
              ]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="position"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
