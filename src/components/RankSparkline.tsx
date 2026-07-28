export default function RankSparkline({
  positions,
  width = 100,
  height = 28,
}: {
  positions: (number | null)[];
  width?: number;
  height?: number;
}) {
  const known = positions.filter((p): p is number => p !== null);
  if (known.length < 2) {
    return <div className="text-xs text-muted">Not enough data</div>;
  }

  const max = Math.max(...known);
  const min = Math.min(...known);
  const range = Math.max(max - min, 1);

  const step = width / (positions.length - 1);
  let lastX = 0;
  let lastY = height / 2;
  const points: string[] = [];

  positions.forEach((p, i) => {
    const x = i * step;
    if (p === null) return;
    // Lower rank position is better, so it should sit near the top (small y)
    // and worse (higher) positions near the bottom - min position maps
    // directly to y=0 with no extra inversion needed. The previous
    // `height - ...` here double-inverted this, making the line slope
    // upward for a *worsening* rank and downward for an *improving* one -
    // backwards from both the big Rank History chart below and the ↑/↓
    // delta shown next to it.
    const y = ((p - min) / range) * height;
    points.push(`${x},${y}`);
    lastX = x;
    lastY = y;
  });

  return (
    <svg width={width} height={height}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="var(--accent)" />
    </svg>
  );
}
