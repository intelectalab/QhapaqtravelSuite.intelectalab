import { cn } from "@/lib/cn";

interface ThresholdGaugeProps {
  label: string;
  value: number | null;
  threshold: number;
  mode: "max" | "min";
  unit?: string;
  detail: string;
  className?: string;
}

const RADIUS = 42;
const ARC = Math.PI * RADIUS;

function point(fraction: number, radius = RADIUS): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [50 + radius * Math.cos(angle), 50 - radius * Math.sin(angle)];
}

export function ThresholdGauge({ label, value, threshold, mode, unit = "%", detail, className }: ThresholdGaugeProps) {
  const scale = Math.max(threshold * 2, (value ?? 0) * 1.1, 1);
  const fraction = value === null ? 0 : Math.min(1, Math.max(0, value / scale));
  const mark = Math.min(1, threshold / scale);
  const ok = value === null || (mode === "max" ? value <= threshold : value >= threshold);
  const color = value === null ? "var(--mute)" : ok ? "var(--ok)" : "var(--warn)";
  const [needleX, needleY] = point(fraction, RADIUS - 8);
  const [markX1, markY1] = point(mark, RADIUS - 7);
  const [markX2, markY2] = point(mark, RADIUS + 7);

  return (
    <div className={cn("lift flex flex-col items-center rounded-tile border px-3 pb-3 pt-2 text-center", ok ? "border-[color-mix(in_srgb,var(--ok)_25%,transparent)]" : "border-[color-mix(in_srgb,var(--warn)_35%,transparent)]", className)}>
      <svg viewBox="0 0 100 58" className="w-full max-w-[150px]" role="img" aria-label={`${label}: ${value === null ? "sin datos" : `${value} ${unit}`}, límite ${threshold} ${unit}`}>
        <path d={`M ${50 - RADIUS} 50 A ${RADIUS} ${RADIUS} 0 0 1 ${50 + RADIUS} 50`} fill="none" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
        <path d={`M ${50 - RADIUS} 50 A ${RADIUS} ${RADIUS} 0 0 1 ${50 + RADIUS} 50`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ARC * fraction} ${ARC}`} className="transition-[stroke-dasharray] duration-700" />
        <line x1={markX1} y1={markY1} x2={markX2} y2={markY2} stroke="var(--fg-2)" strokeWidth="1.6" />
        <line x1="50" y1="50" x2={needleX} y2={needleY} stroke="var(--fg)" strokeWidth="2.2" strokeLinecap="round" className="transition-all duration-700" />
        <circle cx="50" cy="50" r="3.4" fill="var(--fg)" />
      </svg>
      <b className="-mt-1 font-mono text-[18px] font-semibold" style={{ color }}>{value === null ? "—" : `${value} ${unit}`}</b>
      <span className="text-[12.5px] font-semibold">{label}</span>
      <span className="mt-0.5 text-[11.5px] text-fg-3">{detail}</span>
    </div>
  );
}
