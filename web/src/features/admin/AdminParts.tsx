"use client";

import { Check, Copy, History, KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SwitchField } from "@/components/ui/SwitchField";
import { TintCardTitle } from "@/components/ui/Tinted";
import type { AuditEntry, Option } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";

export const RISE = "animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

export function KpiGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return <section className={cn("mb-5 grid grid-cols-2 gap-3", columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>{children}</section>;
}

export function AuditTrail({ entries, title = "Últimos cambios", empty = "Aún no hay cambios registrados." }: { entries: AuditEntry[]; title?: string; empty?: string }) {
  return (
    <Card>
      <TintCardTitle icon={History} title={title} aside={entries.length > 0 ? <Link href="/admin/auditoria" className="text-accent hover:underline">Ver auditoría</Link> : undefined} />
      {entries.length === 0 ? (
        <p className="text-[13px] text-fg-3">{empty}</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, index) => (
            <li key={entry.code} style={{ animationDelay: `${index * 45}ms` }} className={cn("group relative flex gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2", RISE)}>
              <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full transition-transform duration-300 group-hover:scale-150", entry.critical ? "bg-bad" : "bg-accent")} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <b className="font-semibold">{entry.actor}</b> <span className="text-fg-2">{entry.action.replace(/_/g, " ")}</span> <span className="font-mono text-[12px] text-fg-3">{entry.entity_id}</span>
                </p>
                {(entry.before || entry.after) && (
                  <p className="mt-0.5 truncate text-[12px] text-fg-3" title={`${entry.before ?? "—"} → ${entry.after ?? "—"}`}>
                    {entry.before ? <span className="line-through decoration-fg-3/50">{entry.before}</span> : null}
                    {entry.before && entry.after ? " → " : null}
                    {entry.after}
                  </p>
                )}
              </div>
              <Link href={`/admin/auditoria/${entry.code}`} className="flex-none self-start font-mono text-[11.5px] text-fg-3 hover:text-accent">
                {formatDateTime(entry.at, false)}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function UsageBar({ used, limit, label, unit, note }: { used: number; limit: number | null; label: string; unit: string; note?: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone: Tone = limit === null ? "t4" : pct >= 100 ? "bad" : pct >= 80 ? "warn" : "t1";
  return (
    <div style={toneStyle(tone)} className="lift group rounded-tile border border-line bg-surface px-4 py-3.5 shadow-card hover:border-[color-mix(in_srgb,var(--tint)_40%,transparent)]" title={limit === null ? `${label}: sin límite en tu plan` : `${formatNumber(used)} de ${formatNumber(limit)} ${unit} (${pct.toFixed(0)} %)`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] font-medium text-fg-2">{label}</p>
        <p className="text-[12px] text-fg-3">{limit === null ? "Sin límite" : `${pct.toFixed(0)} %`}</p>
      </div>
      <p className="mt-1 text-[19px] font-bold tracking-tight">
        {formatNumber(used)}
        {limit !== null && <span className="text-[13px] font-medium text-fg-3"> / {formatNumber(limit)}</span>}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${limit === null ? 100 : Math.max(pct, 2)}%`, opacity: limit === null ? 0.35 : 1 }} />
      </div>
      {note && <p className="mt-1.5 text-[11.5px] text-fg-3">{note}</p>}
    </div>
  );
}

export function CheckChips({ name, options, defaultValues = [], disabled = false }: { name: string; options: Option[]; defaultValues?: string[]; disabled?: boolean }) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  const toggle = (value: string) => setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
              on ? "border-accent bg-accent text-white" : "border-line bg-surface text-fg-2 hover:border-accent/50 hover:text-fg",
            )}
          >
            {on && <Check size={13} strokeWidth={3} />}
            {option.label}
            {on && <input type="hidden" name={name} value={option.value} />}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleField({ label, name, defaultChecked, hint, disabled }: { label: string; name: string; defaultChecked: boolean; hint?: string; disabled?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <SwitchField label={label} name={name} checked={checked} onCheckedChange={setChecked} hint={hint} disabled={disabled} />;
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <p className="text-[13px] font-semibold text-fg">{children}</p>
      {hint && <p className="text-[12px] text-fg-3">{hint}</p>}
    </div>
  );
}

export function SecretReveal({ secret, title, onClose }: { secret: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
  };
  return (
    <div style={toneStyle("warn")} className={cn("mb-5 rounded-card border border-[color-mix(in_srgb,var(--tint)_35%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] p-4", RISE)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--tint)] text-white">
          <KeyRound size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="text-[12.5px] text-fg-2">Cópialo ahora y guárdalo en un lugar seguro. Por seguridad no lo volveremos a mostrar.</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[10px] bg-surface px-3 py-2 font-mono text-[12.5px]">{secret}</code>
            <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--tint)] px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-0.5">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button type="button" onClick={onClose} className="h-9 rounded-[10px] px-3 text-[12.5px] font-semibold text-fg-2 hover:bg-surface">
              Ya lo guardé
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={toneStyle("warn")} className={cn("mb-4 flex gap-2.5 rounded-[12px] bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-3.5 py-3 text-[13px]", RISE)}>
      <ShieldAlert size={17} className="mt-0.5 flex-none text-[var(--tint)]" />
      <div>{items.map((item) => <p key={item}>{item}</p>)}</div>
    </div>
  );
}

export function EmptyCard({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <Card>
      <EmptyState icon={icon} title={title} description={description} />
    </Card>
  );
}
