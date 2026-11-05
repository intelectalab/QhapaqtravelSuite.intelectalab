import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { statusLabel, statusTone, toneStyle, type Tone } from "@/lib/tone";

export function Badge({ tone = "mute", dot = true, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span style={toneStyle(tone)} className={cn("tint-soft inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-xs font-semibold", className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint)]" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? statusLabel(status)}</Badge>;
}

export function LiveTag({ children, tone = "t4" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span style={toneStyle(tone)} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--tint)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--tint)_20%,transparent)]" />
      {children}
    </span>
  );
}
