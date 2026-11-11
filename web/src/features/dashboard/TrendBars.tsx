"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";

export interface TrendSeries {
  name: string;
  tone: Tone;
  values: number[];
}

export function TrendBars({ labels, series, unit, height = 140 }: { labels: string[]; series: TrendSeries[]; unit: "money" | "count"; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const format = (value: number) => (unit === "money" ? formatMoney(value) : String(value));
  const max = Math.max(1, ...series.flatMap((item) => item.values));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((item) => (
          <span key={item.name} style={toneStyle(item.tone)} className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--tint)]" />
            {item.name}
          </span>
        ))}
      </div>
      <div className="grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
        {labels.map((label, index) => {
          const isActive = active === index;
          return (
            <div key={label} className="relative flex cursor-default flex-col items-center gap-1.5" onPointerEnter={() => setActive(index)}>
              {isActive && (
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 flex flex-col whitespace-nowrap rounded-lg bg-fg px-2.5 py-1.5 text-[11.5px] font-semibold text-bg shadow-lg motion-safe:animate-[drop-in_160ms_ease-out]">
                  {series.map((item) => (
                    <span key={item.name}>
                      {item.name}: {format(item.values[index] ?? 0)}
                    </span>
                  ))}
                </span>
              )}
              <div className="flex w-full items-end justify-center gap-1" style={{ height }}>
                {series.map((item, position) => (
                  <span
                    key={item.name}
                    style={{ ...toneStyle(item.tone), height: `${Math.max(4, ((item.values[index] ?? 0) / max) * height)}px`, animationDelay: `${index * 70 + position * 40}ms` }}
                    className={cn("w-full max-w-[22px] origin-bottom rounded-t-[7px] rounded-b-[3px] bg-[var(--tint)] transition-[opacity,filter] duration-200 motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]", active !== null && !isActive && "opacity-45", isActive && "brightness-110")}
                  />
                ))}
              </div>
              <span className={cn("font-mono text-[11.5px] text-fg-3 transition-colors", isActive && "text-fg")}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
