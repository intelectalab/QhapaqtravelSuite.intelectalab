"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

function scale(values: number[], height: number, padding = 4): number[] {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((value) => padding + (1 - (value - min) / span) * (height - padding * 2));
}

export function Sparkline({ values, labels, className }: { values: number[]; labels?: string[]; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 300;
  const height = 46;
  const ys = scale(values, height, 8);
  const step = width / Math.max(1, values.length - 1);
  const line = ys.map((y, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.min(values.length - 1, Math.max(0, Math.round(ratio * (values.length - 1)))));
  };

  return (
    <div className={cn("group/spark", className)} onPointerMove={pick} onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden>
        <path d={`${line} L${width} ${height} L0 ${height}Z`} fill="currentColor" className="opacity-[0.16] transition-opacity duration-300 group-hover/spark:opacity-[0.26] motion-safe:animate-[fade-in_900ms_ease-out]" />
        <path
          d={line}
          pathLength={1}
          strokeDasharray={1}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          vectorEffect="non-scaling-stroke"
          className="opacity-60 transition-opacity duration-300 group-hover/spark:opacity-100 motion-safe:animate-[draw-line_1100ms_ease-out]"
        />
        {active !== null && <line x1={active * step} x2={active * step} y1={0} y2={height} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="opacity-50" />}
      </svg>
      {active !== null && (
        <>
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-current bg-white transition-[left,top] duration-150"
            style={{ left: `${(active / Math.max(1, values.length - 1)) * 100}%`, top: `${ys[active]}px` }}
          />
          {labels?.[active] && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-[left] duration-150"
              style={{ left: `${Math.min(88, Math.max(12, (active / Math.max(1, values.length - 1)) * 100))}%`, top: `${ys[active] - 28}px` }}
            >
              {labels[active]}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export interface PairedDatum {
  label: string;
  first: number;
  second: number;
}

export function PairedBarChart({ data, labels, height = 110 }: { data: PairedDatum[]; labels: [string, string]; height?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.flatMap((item) => [item.first, item.second])) || 1;
  const bar = (value: number) => `${Math.max(4, (value / max) * height)}px`;

  return (
    <div>
      <div className="mb-3 flex gap-4 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-t1" />{labels[0]}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-t2" />{labels[1]}</span>
      </div>
      <div className="grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
        {data.map((item, index) => {
          const isActive = active === item.label;
          return (
            <div key={item.label} className="flex flex-col items-center gap-1.5" onPointerEnter={() => setActive(item.label)}>
              <div className="relative flex w-full items-end justify-center gap-1" style={{ height }}>
                {isActive && (
                  <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11.5px] font-semibold text-bg shadow-lg">
                    {item.first} {labels[0].toLowerCase()} · {item.second} {labels[1].toLowerCase()}
                  </span>
                )}
                {[{ value: item.first, tone: "bg-t1" }, { value: item.second, tone: "bg-t2" }].map((serie, position) => (
                  <span key={position} className={cn("w-full max-w-[18px] origin-bottom rounded-t-[6px] motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]", serie.tone, active !== null && !isActive && "opacity-45")} style={{ height: bar(serie.value), animationDelay: `${index * 70 + position * 40}ms` }} />
                ))}
              </div>
              <span className={cn("font-mono text-[11.5px] text-fg-3", isActive && "text-fg")}>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  caption: string;
  detail?: string;
  highlight?: boolean;
}

export function BarChart({ data, height = 118, reference }: { data: BarDatum[]; height?: number; reference?: { value: number; label: string } }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.map((item) => item.value), reference?.value ?? 0) || 1;

  return (
    <div className="grid items-end gap-3.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
      {data.map((item, index) => {
        const isActive = active === item.label;
        const dimmed = active !== null && !isActive;
        return (
          <div key={item.label} className="flex cursor-default flex-col items-center gap-1.5" onPointerEnter={() => setActive(item.label)}>
            <div className="relative flex w-full items-end" style={{ height }}>
              {reference && <span aria-hidden className="pointer-events-none absolute inset-x-[-7px] border-t border-dashed border-bad/60" style={{ bottom: `${(reference.value / max) * height}px` }} title={reference.label} />}
              {isActive && (
                <span className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11.5px] font-semibold text-bg shadow-lg motion-safe:animate-[drop-in_160ms_ease-out]" style={{ bottom: `${Math.max(6, (item.value / max) * height) + 8}px` }}>
                  {item.detail ?? item.caption}
                </span>
              )}
              <div
                className={cn(
                  "w-full origin-bottom rounded-t-[10px] rounded-b-[4px] transition-[transform,opacity,filter] duration-200 ease-out motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]",
                  item.highlight ? "bg-t2" : "bg-[color-mix(in_srgb,var(--t1)_85%,transparent)]",
                  isActive && "scale-x-[1.06] brightness-110",
                  dimmed && "opacity-45",
                )}
                style={{ height: `${Math.max(6, (item.value / max) * height)}px`, animationDelay: `${index * 70}ms` }}
              />
            </div>
            <span className={cn("font-mono text-[11.5px] text-fg-3 transition-colors", isActive && "text-fg")}>
              {item.label.charAt(0).toUpperCase() + item.label.slice(1)} <b className="font-semibold text-fg">{item.caption}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
