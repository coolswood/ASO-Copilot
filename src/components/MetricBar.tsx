import { metricColor } from "@/lib/metricColor";

export default function MetricBar({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const color = metricColor(value, inverse);
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
