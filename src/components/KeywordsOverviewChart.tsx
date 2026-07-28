"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface KeywordRankSeries {
  id: string;
  term: string;
  ranks: { position: number | null; checkedAt: string | Date }[];
}

interface ChartPoint {
  dateLabel: string;
  xLabel: string;
  [keywordId: string]: string | number | null;
}

const RANGES = [7, 30] as const;

// Fixed hue order, never reassigned per filter/selection - validated (dataviz
// skill) for CVD-safe adjacent separation and contrast against this app's
// --card surface. A 9th keyword never gets a generated color; see MAX_SERIES.
const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];
const MAX_SERIES = SERIES_COLORS.length;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function CustomTooltip({
  active,
  payload,
  shown,
  colorById,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  shown: KeywordRankSeries[];
  colorById: Map<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rows = shown
    .map((k) => ({ k, value: point[k.id] as number | null | undefined }))
    .filter((r): r is { k: KeywordRankSeries; value: number } => r.value !== undefined && r.value !== null)
    .sort((a, b) => a.value - b.value);
  if (rows.length === 0) return null;

  return (
    <div className="max-w-[220px] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-medium">{point.dateLabel}</div>
      <div className="space-y-1">
        {rows.map(({ k, value }) => (
          <div key={k.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorById.get(k.id) }} />
              <span className="truncate">{k.term}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">#{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legend doubles as the "which keyword is which color" key (required
 * whenever >=2 series are on screen) and a click-to-toggle filter - since
 * only up to MAX_SERIES lines are plotted at once, hiding a couple frees up
 * visual room without needing a second chart. */
function CustomLegend({
  shown,
  colorById,
  hidden,
  onToggle,
}: {
  shown: KeywordRankSeries[];
  colorById: Map<string, string>;
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-3">
      {shown.map((k) => {
        const isHidden = hidden.has(k.id);
        return (
          <button
            key={k.id}
            onClick={() => onToggle(k.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs transition-colors hover:border-accent ${
              isHidden ? "text-muted opacity-50" : "text-foreground"
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: isHidden ? "var(--border)" : colorById.get(k.id) }}
            />
            {k.term}
          </button>
        );
      })}
    </div>
  );
}

export default function KeywordsOverviewChart({ keywords }: { keywords: KeywordRankSeries[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const withPositions = useMemo(
    () => keywords.filter((k) => k.ranks.some((r) => r.position !== null)),
    [keywords],
  );

  // Best (lowest = closest to #1) latest position first - the most relevant
  // keywords to compare, and the natural cutoff when there are more tracked
  // keywords than the 8-color budget allows plotting at once.
  const shown = useMemo(() => {
    return [...withPositions]
      .sort((a, b) => {
        const la = a.ranks[0]?.position ?? Infinity;
        const lb = b.ranks[0]?.position ?? Infinity;
        return la - lb;
      })
      .slice(0, MAX_SERIES);
  }, [withPositions]);

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    shown.forEach((k, i) => map.set(k.id, SERIES_COLORS[i]));
    return map;
  }, [shown]);

  const data = useMemo<ChartPoint[]>(() => {
    const byDate = new Map<string, ChartPoint>();
    for (const k of shown) {
      const chronological = [...k.ranks].reverse();
      const sliced = chronological.slice(-range);
      for (const r of sliced) {
        const date = new Date(r.checkedAt);
        const key = dateKey(date);
        if (!byDate.has(key)) {
          byDate.set(key, {
            dateLabel: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
            xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          });
        }
        byDate.get(key)![k.id] = r.position;
      }
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v);
  }, [shown, range]);

  const knownPositions = shown.flatMap((k) =>
    k.ranks.map((r) => r.position).filter((p): p is number => p !== null),
  );
  const omitted = withPositions.length - shown.length;

  if (withPositions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">All keywords - rank history</div>
          {omitted > 0 && (
            <div className="text-xs text-muted">
              Showing the {shown.length} best-ranked of {withPositions.length} tracked keywords.
            </div>
          )}
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border p-0.5">
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
        <ResponsiveContainer width="100%" height={260}>
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
            <Tooltip content={<CustomTooltip shown={shown} colorById={colorById} />} />
            {shown.map((k) => (
              <Line
                key={k.id}
                dataKey={k.id}
                stroke={colorById.get(k.id)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                hide={hidden.has(k.id)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <CustomLegend shown={shown} colorById={colorById} hidden={hidden} onToggle={toggle} />
    </div>
  );
}
