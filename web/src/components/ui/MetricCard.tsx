"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { InfoCover, InfoTip } from "@/components/ui/InfoTip";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  note?: ReactNode;
  info?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function MetricCard({ label, value, icon, tone = "t1", note, info, active = false, onClick, testId }: MetricCardProps) {
  const explains = !onClick && info;
  return (
    <div
      data-testid={onClick || explains ? undefined : testId}
      style={toneStyle(tone)}
      className={cn(
        "lift group relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] gap-1.5 rounded-tile border p-1.5 transition-[border-color,box-shadow]",
        active ? "border-[var(--tint)] bg-[color-mix(in_srgb,var(--tint)_16%,var(--surface))] shadow-[0_0_0_2px_var(--tint)]" : "border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]",
      )}
    >
      {onClick && <button type="button" data-testid={testId} onClick={onClick} aria-pressed={active} aria-label={label} className="absolute inset-0 z-[1] rounded-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tint)]" />}
      {explains && (
        <span className="absolute inset-0 z-[1] rounded-tile">
          <InfoCover label={`De dónde sale: ${label}`} testId={testId}>
            {info}
          </InfoCover>
        </span>
      )}
      {icon && (
        <span className="pointer-events-none relative grid h-10 w-10 place-items-center overflow-hidden rounded-[11px] bg-[var(--tint)] text-white shadow-[0_8px_16px_-10px_var(--tint)]">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:16px_16px] opacity-[0.16] transition-[background-position] duration-700 ease-out group-hover:bg-[position:8px_8px]" />
          <span className="relative transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">{icon}</span>
        </span>
      )}
      <span className={cn("pointer-events-none flex min-h-10 min-w-0 items-center gap-1 rounded-[11px] px-3 text-[12px] font-semibold transition-colors duration-300", !icon && "col-span-2", active ? "bg-[var(--tint)] text-white" : "bg-[color-mix(in_srgb,var(--tint)_14%,var(--surface))] text-[var(--tint)] group-hover:bg-[color-mix(in_srgb,var(--tint)_20%,var(--surface))]")}>
        <span className="line-clamp-2 py-1 leading-tight" title={label}>{label}</span>
        {explains && <Info size={13} strokeWidth={2.2} aria-hidden className="flex-none opacity-80" />}
        {onClick && info && (
          <span className="pointer-events-auto relative z-[2] flex-none">
            <InfoTip label={`De dónde sale: ${label}`} className={cn("h-4 w-4", active ? "text-white/85 hover:bg-white/15 hover:text-white" : "text-[var(--tint)] hover:bg-surface")}>
              {info}
            </InfoTip>
          </span>
        )}
      </span>
      <span className="pointer-events-none col-span-2 flex min-h-[60px] flex-col items-start justify-center gap-1.5 rounded-[12px] bg-surface px-3.5 py-2.5">
        <span className="whitespace-nowrap text-[19px] font-bold leading-tight tracking-tight transition-transform duration-300 group-hover:translate-x-0.5">{value}</span>
        {note && <span className="line-clamp-2 max-w-full rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--tint)]">{note}</span>}
      </span>
    </div>
  );
}

export function MetricCardRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{children}</div>;
}
