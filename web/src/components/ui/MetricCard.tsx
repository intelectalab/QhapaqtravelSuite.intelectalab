import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}

export function MetricCard({ label, value, icon, tone = "t1", active = false, onClick }: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={toneStyle(tone)}
      className={cn(
        "lift group flex min-w-0 items-center gap-3 rounded-tile border px-4 py-3.5 text-left shadow-card",
        active ? "border-[var(--tint)] bg-[var(--tint)] text-white" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--tint)_40%,transparent)]",
      )}
    >
      {icon && (
        <span className={cn("grid h-[38px] w-[38px] flex-none place-items-center rounded-[12px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", active ? "bg-white/15 text-white" : "tint-soft")}>{icon}</span>
      )}
      <span className="min-w-0">
        <span className="block text-[22px] font-bold leading-none tracking-tight">{value}</span>
        <span className={cn("mt-1 block truncate text-[12.5px]", active ? "text-white/75" : "text-fg-3")}>{label}</span>
      </span>
    </button>
  );
}

export function MetricCardRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">{children}</div>;
}
