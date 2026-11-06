import { BadgeCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Money, Rating } from "@/lib/site";

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={1.6} className={n <= Math.round(value) ? "fill-t2 text-t2" : "text-fg-3/40"} />
      ))}
    </span>
  );
}

export function RatingLine({ rating, compact = false }: { rating: Rating | null; compact?: boolean }) {
  if (!rating) return <span className="text-[12px] text-fg-3">Aún sin reseñas</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
      <Stars value={rating.avg} size={compact ? 12 : 14} />
      <b className="font-semibold text-fg">{rating.avg.toFixed(1)}</b>
      <span className="text-fg-3">({rating.count})</span>
      {rating.verified && (
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ok" title="Opiniones de pasajeros con reserva completada">
          <BadgeCheck size={13} />
          {!compact && "Viaje verificado"}
        </span>
      )}
    </span>
  );
}

export function PriceTag({ from, list, label = "Desde", size = "md", unit = "por persona" }: { from: Money | null; list?: number | null; label?: string; size?: "md" | "lg"; unit?: string }) {
  if (!from) return <span className="text-[13px] font-semibold text-fg-3">Tarifa por publicar</span>;
  return (
    <span className="leading-tight">
      <span className="block text-[11.5px] font-medium text-fg-3">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <b className={cn("font-bold tracking-tight text-fg", size === "lg" ? "text-[26px]" : "text-[18px]")}>{formatMoney(from.amount, from.currency)}</b>
        {list != null && <s className="text-[12.5px] text-fg-3">{formatMoney(list, from.currency)}</s>}
      </span>
      <span className="block text-[11px] text-fg-3">{unit}</span>
    </span>
  );
}

export function SectionHeading({ eyebrow, title, description, action, className }: { eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-[640px]">
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide text-brand">
            <span aria-hidden className="weave-line h-[3px] w-6 rounded-full" />
            {eyebrow}
          </span>
        )}
        <h2 className="text-[26px] font-bold leading-tight tracking-tight text-fg sm:text-[30px]">{title}</h2>
        {description && <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({ children, tone = "mute", className }: { children: ReactNode; tone?: "mute" | "brand" | "ok" | "warn" | "t2" | "t4"; className?: string }) {
  const tones = {
    mute: "bg-surface-2 text-fg-2",
    brand: "bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-brand",
    ok: "bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok",
    warn: "bg-[color-mix(in_srgb,var(--warn)_15%,transparent)] text-warn",
    t2: "bg-[color-mix(in_srgb,var(--t2)_22%,transparent)] text-[color-mix(in_srgb,var(--t2)_60%,var(--fg))]",
    t4: "bg-[color-mix(in_srgb,var(--t4)_13%,transparent)] text-t4",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function Occupancy({ sold, capacity, spots }: { sold: number; capacity: number; spots: number }) {
  const pct = Math.min(100, Math.round((sold / Math.max(1, capacity)) * 100));
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full origin-left animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-full", spots <= 4 ? "bg-warn" : "bg-t4")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-fg-3">
        <span>
          {sold} de {capacity} reservados
        </span>
        <b className={cn("font-semibold", spots <= 4 ? "text-warn" : "text-fg-2")}>{spots === 1 ? "Queda 1 cupo" : `Quedan ${spots} cupos`}</b>
      </div>
    </div>
  );
}
