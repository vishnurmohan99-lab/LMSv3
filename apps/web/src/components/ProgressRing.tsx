"use client";

export default function ProgressRing({
  pct,
  color,
  size,
  strokeWidth,
  trackColor = "rgba(0,0,0,.08)",
}: {
  pct: number;
  color: string;
  size: number;
  strokeWidth: number;
  trackColor?: string;
}) {
  const r = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, pct)));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .5s ease" }}
      />
    </svg>
  );
}
