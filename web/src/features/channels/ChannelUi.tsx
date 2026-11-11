"use client";

import { Star } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { SidePanel } from "@/components/ui/SidePanel";
import { channelStatus, type Money } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";

export function ChannelBadge({ status, label }: { status: string; label?: string }) {
  const meta = channelStatus(status);
  return <Badge tone={meta.tone}>{label ?? meta.label}</Badge>;
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} title={`${value} de 5`} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star key={index} size={size} strokeWidth={1.8} className={cn("transition-transform duration-200 hover:scale-125", index <= Math.round(value) ? "fill-[var(--t2)] text-[var(--t2)]" : "text-line")} />
      ))}
    </span>
  );
}

export function MoneyLines({ values, empty = "—" }: { values: Money; empty?: string }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <>{empty}</>;
  return (
    <span className="flex flex-col leading-tight">
      {entries.map(([currency, amount]) => (
        <span key={currency}>{formatMoney(amount, currency)}</span>
      ))}
    </span>
  );
}

export function UsageBar({ pct, tone }: { pct: number; tone?: Tone }) {
  const color: Tone = tone ?? (pct >= 90 ? "bad" : pct >= 70 ? "warn" : "ok");
  return (
    <span style={toneStyle(color)} className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} />
    </span>
  );
}

export function DetailPanel({ label, title, description, children }: { label: string; title: string; description?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label={label} onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={description}>
        <div className="flex flex-col gap-5">{children}</div>
      </SidePanel>
    </>
  );
}

export function PanelSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center justify-between border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">
        {title}
        {aside && <span className="text-[12px] font-medium text-fg-3">{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

export function Timeline({ items }: { items: { key: string; title: ReactNode; meta: ReactNode; note?: ReactNode }[] }) {
  if (items.length === 0) return <p className="text-[13px] text-fg-3">Sin movimientos registrados.</p>;
  return (
    <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
      {items.map((item, index) => (
        <li key={item.key} style={{ animationDelay: `${index * 60}ms` }} className="relative animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
          <p className="text-[13.5px] font-medium">{item.title}</p>
          <p className="text-[12px] text-fg-3">{item.meta}</p>
          {item.note && <p className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-fg-2">{item.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function CodeSnippet({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cn("relative", className)}>
      <pre className="scroll-thin max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-tile bg-fg p-3.5 pr-20 font-mono text-[12px] leading-relaxed text-bg">{code}</pre>
      <button type="button" onClick={copy} className="absolute right-2 top-2 rounded-md bg-surface/90 px-2 py-1 text-[11.5px] font-semibold text-fg transition-transform duration-300 hover:-translate-y-0.5">
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

export function PreviewPicker({ label, value, options, param }: { label: string; value: string | undefined; options: { value: string; label: string }[]; param: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const change = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(param, next);
    else query.delete(param);
    router.push(`${pathname}?${query.toString()}`);
  };
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[13px] font-semibold text-fg-2">{label}</span>
      <Select value={value ?? ""} onChange={change} options={options} ariaLabel={label} className="h-10 min-w-[240px]" />
    </div>
  );
}
