import { cn } from "@/lib/cn";

function scale(values: number[], height: number, padding = 4): number[] {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((value) => padding + (1 - (value - min) / span) * (height - padding * 2));
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 300;
  const height = 46;
  const ys = scale(values, height, 8);
  const step = width / Math.max(1, values.length - 1);
  const line = ys.map((y, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("pointer-events-none", className)} aria-hidden>
      <path d={`${line} L${width} ${height} L0 ${height}Z`} fill="currentColor" opacity="0.18" />
      <path d={line} stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  caption: string;
  highlight?: boolean;
}

export function BarChart({ data, height = 118 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(...data.map((item) => item.value)) || 1;
  return (
    <div className="grid items-end gap-3.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
      {data.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1.5">
          <div className="flex w-full items-end" style={{ height }}>
            <div
              title={item.caption}
              className={cn("w-full rounded-t-[10px] rounded-b-[4px] transition-[height]", item.highlight ? "bg-t2" : "bg-[color-mix(in_srgb,var(--t1)_85%,transparent)]")}
              style={{ height: `${Math.max(6, (item.value / max) * height)}px` }}
            />
          </div>
          <span className="font-mono text-[11.5px] text-fg-3">
            {item.label.toUpperCase()} <b className="font-semibold text-fg">{item.caption}</b>
          </span>
        </div>
      ))}
    </div>
  );
}
