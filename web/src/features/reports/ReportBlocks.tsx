import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Breakdown } from "@/lib/reports";
import { statusLabel, statusTone, toneStyle, type Tone } from "@/lib/tone";

export function ShareBars({ title, icon, rows, tone, empty }: { title: string; icon: LucideIcon; rows: Breakdown[]; tone: Tone; empty: string }) {
  const total = rows.reduce((sum, row) => sum + row.sales, 0) || 1;
  return (
    <Card>
      <TintCardTitle icon={icon} title={title} tone={tone} />
      {rows.length === 0 ? (
        <p className="text-[13px] text-fg-3">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3" style={toneStyle(tone)}>
          {rows.map((row, index) => (
            <li key={row.label} className="group" title={`${row.count} reservas`}>
              <div className="mb-1 flex justify-between gap-3 text-[13px]">
                <span className="font-medium">{row.label}</span>
                <span className="font-mono text-fg-2">{formatMoney(row.sales, "PEN", { compact: true })}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <div className="h-full origin-left rounded-full bg-[var(--tint)] opacity-80 transition-opacity group-hover:opacity-100 motion-safe:animate-[fill-x_800ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(4, (row.sales / total) * 100)}%`, animationDelay: `${index * 90}ms` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function StatusStrip({ items }: { items: { status: string; count: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {items.map((item) => (
          <span key={item.status} title={`${statusLabel(item.status)}: ${item.count}`} style={{ ...toneStyle(statusTone(item.status)), width: `${(item.count / total) * 100}%` }} className="h-full bg-[var(--tint)] transition-[filter] hover:brightness-110" />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {items.map((item) => (
          <li key={item.status} style={toneStyle(statusTone(item.status))} className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <span className="h-2 w-2 rounded-full bg-[var(--tint)]" />
            {statusLabel(item.status)} <b className="text-fg">{item.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Ratio({ label, value, note, tone }: { label: string; value: number | null; note: string; tone: Tone }) {
  const pct = value ?? 0;
  return (
    <div style={toneStyle(tone)} className={cn("lift rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] p-4")}>
      <p className="text-[12.5px] font-semibold text-[var(--tint)]">{label}</p>
      <p className="mt-1 text-[26px] font-bold leading-none tracking-tight">{value === null ? "—" : `${pct.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`}</p>
      <div className="mt-3 h-1.5 rounded-full bg-surface">
        <div className="h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_900ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-fg-3">{note}</p>
    </div>
  );
}
