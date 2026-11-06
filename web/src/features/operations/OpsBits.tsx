import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDate, initials, shortName } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";

export function Meter({ value, total, tone = "accent", label }: { value: number; total: number; tone?: Tone; label?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="group/meter flex min-w-[110px] flex-col gap-1" style={toneStyle(tone)} title={label ?? `${value} de ${total}`}>
      <span className="flex items-baseline justify-between gap-2 text-[12px]">
        <b className="font-mono font-semibold text-fg">
          {value}/{total}
        </b>
        <span className="text-fg-3">{pct} %</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full origin-left rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover/meter:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export function PersonChip({ name, color, note }: { name: string; color?: string | null; note?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold text-white transition-transform duration-300 hover:scale-110" style={{ background: color ?? "var(--accent)" }}>
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{shortName(name)}</span>
        {note && <span className="block truncate text-xs text-fg-3">{note}</span>}
      </span>
    </span>
  );
}

export function DateRange({ from, to }: { from: string; to: string }) {
  return (
    <span className="text-[13px]">
      {from === to ? formatDate(from) : `${formatDate(from).replace(/ \d{4}$/, "")} al ${formatDate(to)}`}
    </span>
  );
}

export function SlaBar({ pct, overdue, closed }: { pct: number; overdue: boolean; closed: boolean }) {
  const tone: Tone = closed ? "mute" : overdue ? "bad" : pct >= 75 ? "warn" : "ok";
  return (
    <span className="group/sla block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" style={toneStyle(tone)}>
      <span className="block h-full rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover/sla:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${closed ? 100 : Math.max(4, pct)}%` }} />
    </span>
  );
}

export function Notice({ tone, icon, children, action }: { tone: Tone; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={toneStyle(tone)} className="mb-5 flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-3 rounded-card border border-[color-mix(in_srgb,var(--tint)_35%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-4 py-3 text-[13.5px]">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-[var(--tint)] text-white">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function TimeSlot({ time, className }: { time: string | null; className?: string }) {
  return <span className={cn("inline-block min-w-[44px] font-mono text-[12.5px] font-semibold text-[var(--tint,var(--accent))]", className)}>{time ?? "—"}</span>;
}
