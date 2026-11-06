"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";

export interface RankDatum {
  label: string;
  value: number;
  caption: string;
  detail?: string;
  tone?: Tone;
}

export function RankBars({ data, tone = "t1", empty }: { data: RankDatum[]; tone?: Tone; empty: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  if (data.length === 0) return <p className="py-6 text-center text-[13px] text-fg-3">{empty}</p>;

  return (
    <ul className="grid gap-2.5" onPointerLeave={() => setActive(null)}>
      {data.map((item, index) => {
        const width = Math.max(4, (Math.abs(item.value) / max) * 100);
        const dimmed = active !== null && active !== item.label;
        return (
          <li
            key={item.label}
            style={{ ...toneStyle(item.tone ?? tone), animationDelay: `${index * 60}ms` }}
            className={cn("group grid cursor-default gap-1 transition-opacity duration-200 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", dimmed && "opacity-50")}
            onPointerEnter={() => setActive(item.label)}
            title={item.detail}
          >
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium text-fg">{item.label}</span>
              <span className="font-mono text-[12.5px] font-semibold text-fg">{item.caption}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full origin-left rounded-full bg-[var(--tint)] transition-[filter,transform] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]"
                style={{ width: `${width}%`, animationDelay: `${index * 60}ms` }}
              />
            </div>
            {item.detail && <span className="text-[11.5px] text-fg-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">{item.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
