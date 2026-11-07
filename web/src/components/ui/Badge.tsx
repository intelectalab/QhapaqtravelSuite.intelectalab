import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { statusLabel, statusTone, toneStyle, type Tone } from "@/lib/tone";

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
  status?: string;
  testId?: string;
}

export function Badge({ tone = "mute", dot = true, children, className, status, testId }: BadgeProps) {
  return (
    <span style={toneStyle(tone)} data-status={status} data-testid={testId} className={cn("tint-soft inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-xs font-semibold", className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint)]" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label, primary = false }: { status: string; label?: string; primary?: boolean }) {
  return (
    <Badge tone={statusTone(status)} status={status} testId={primary ? "status-badge" : undefined}>
      {label ?? statusLabel(status)}
    </Badge>
  );
}

export function LiveTag({ children, tone = "t4" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span style={toneStyle(tone)} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--tint)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--tint)_20%,transparent)]" />
      {children}
    </span>
  );
}
