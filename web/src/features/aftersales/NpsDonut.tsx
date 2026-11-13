"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";

const SLICES: { key: "promoters" | "passives" | "detractors"; label: string; note: string; tone: Tone }[] = [
  { key: "promoters", label: "Promotores", note: "9 y 10", tone: "ok" },
  { key: "passives", label: "Pasivos", note: "7 y 8", tone: "warn" },
  { key: "detractors", label: "Detractores", note: "0 a 6", tone: "bad" },
];

export function NpsDonut({ promoters, passives, detractors }: { promoters: number; passives: number; detractors: number }) {
  const [active, setActive] = useState<number | null>(null);
  const counts = { promoters, passives, detractors };
  const total = promoters + passives + detractors;
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const share = (index: number) => (total > 0 ? counts[SLICES[index].key] / total : 0);
  const start = (index: number) => SLICES.slice(0, index).reduce((sum, _, position) => sum + share(position), 0);
  const focus = active === null ? null : SLICES[active];

  if (total === 0) return <p className="grid h-28 place-items-center text-[13px] text-fg-3">Aún no hay encuestas en los últimos 12 meses.</p>;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[132px] w-[132px] flex-none">
        <svg viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth={10} stroke="var(--surface-2)" />
          {SLICES.map((slice, index) => (
            <circle key={slice.key} cx="50" cy="50" r={radius} fill="none" strokeWidth={active === index ? 13 : 10} style={toneStyle(slice.tone)} stroke="var(--tint)" strokeDasharray={`${share(index) * length} ${length}`} strokeDashoffset={-start(index) * length} className="cursor-pointer transition-[stroke-width] duration-200" onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-center">
          <span>
            <b className="block font-mono text-[20px] leading-none">{focus ? counts[focus.key] : total}</b>
            <span className="text-[11px] text-fg-3">{focus ? `${Math.round(share(active ?? 0) * 100)} %` : "respuestas"}</span>
          </span>
        </span>
      </div>
      <ul className="grid min-w-0 flex-1 gap-1.5">
        {SLICES.map((slice, index) => (
          <li key={slice.key} style={toneStyle(slice.tone)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors", active === index && "bg-surface-2")}>
            <span className="h-2.5 w-2.5 flex-none rounded-full bg-[var(--tint)]" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{slice.label}</span> <span className="text-[11.5px] text-fg-3">{slice.note}</span>
            </span>
            <b className="font-mono">{counts[slice.key]}</b>
            <span className="w-10 text-right text-[12px] text-fg-3">{Math.round(share(index) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
