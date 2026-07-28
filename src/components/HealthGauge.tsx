import { healthScoreTier } from "@/lib/health";

export default function HealthGauge({ score, size = 120 }: { score: number; size?: number }) {
  const { label, color } = healthScoreTier(score);
  const strokeWidth = size < 100 ? 6 : 8;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--border)"
            strokeWidth={strokeWidth}
            fill="none"
          />
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
                animation: "gauge-fill 1s cubic-bezier(0.16, 1, 0.3, 1) both",
              } as React.CSSProperties
            }
          />
        </svg>
        <div
          className={`absolute inset-0 flex items-center justify-center font-bold animate-fade-in [animation-delay:400ms] ${
            size < 100 ? "text-xl" : "text-2xl"
          }`}
        >
          {score}
        </div>
      </div>
      <div className="text-sm font-medium animate-fade-in [animation-delay:600ms]" style={{ color }}>
        {label}
      </div>
      {size >= 100 && <div className="text-xs text-muted">ASO Health Score: {score}/100</div>}
    </div>
  );
}
