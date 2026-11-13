"use client";

import { Camera, Coins, Lock, PencilLine, ShieldCheck, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { StatusBadge } from "@/components/ui/Badge";
import { SidePanel } from "@/components/ui/SidePanel";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { QuoteVersion } from "@/lib/quotes";
import { statusLabel } from "@/lib/tone";
import { QuoteItinerary } from "./QuoteItinerary";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold">{title}</h4>
      {children}
    </section>
  );
}

export function QuoteVersionView({ version, currency, current, seeMargin }: { version: QuoteVersion; currency: string; current: boolean; seeMargin: boolean }) {
  const [open, setOpen] = useState(false);
  const chips = [
    { icon: Coins, label: currency === "PEN" ? "Soles" : `${currency}${version.fx_rate ? ` · TC ${version.fx_rate}` : ""}` },
    ...(seeMargin && version.markup_pct ? [{ icon: TrendingUp, label: `Markup ${Number(version.markup_pct)} %` }] : []),
    { icon: version.frozen_at || version.status !== "borrador" ? Lock : PencilLine, label: version.frozen_at ? `Congelada el ${formatDateTime(version.frozen_at)}` : version.status === "borrador" ? "Aún editable" : "Congelada al enviarse" },
    { icon: Camera, label: version.snapshot },
    { icon: ShieldCheck, label: version.internal_status ? `Gerencia: ${statusLabel(version.internal_status).toLowerCase()}` : "Sin aprobación interna" },
  ];

  return (
    <>
      <RowIcon tone="view" label={`Ver la versión ${version.number}`} onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={`Versión ${version.number}${current ? " · vigente" : ""}`} description={`Emitida el ${formatDate(version.issued_on)} por ${version.author}.`}>
        <div className="flex flex-col gap-5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={version.status} />
            {chips.map((chip) => (
              <span key={chip.label} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px]">
                <chip.icon size={14} className="flex-none text-[var(--t1)]" />
                <span className="truncate">{chip.label}</span>
              </span>
            ))}
          </div>
          {version.notes && <p className={cn("rounded-[12px] px-3.5 py-2.5 text-[13px] text-fg-2", SOFT_TINT)}>{version.notes}</p>}
          <Block title="Ítems">
            <ul className="flex flex-col gap-1.5">
              {version.items.map((item) => (
                <li key={item.line} className="flex items-center justify-between gap-3 rounded-[12px] border border-line-2 px-3 py-2">
                  <span className="min-w-0">
                    <b className="block truncate text-[13px] font-semibold">{item.product.name}</b>
                    <span className="text-xs text-fg-3">
                      {formatDate(item.date)} · {item.pax} {item.segment.toLowerCase()}
                      {item.pax === 1 ? "" : "s"}
                      {item.qty > 1 ? ` × ${item.qty}` : ""}
                    </span>
                  </span>
                  <b className="flex-none font-mono text-[13px]">{formatMoney(item.total, currency)}</b>
                </li>
              ))}
            </ul>
            <dl className="ml-auto flex w-full max-w-[280px] flex-col gap-1 text-[13px]">
              {Number(version.totals.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-fg-3">Descuento ({version.discount_pct} %)</dt>
                  <dd className="font-mono text-bad">− {formatMoney(version.totals.discount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd className="font-mono">{formatMoney(version.totals.grand, currency)}</dd>
              </div>
              {seeMargin && version.totals.margin_pct !== null && (
                <div className="flex justify-between text-[12.5px]">
                  <dt className="text-fg-3">Margen</dt>
                  <dd className="font-mono">{version.totals.margin_pct} %</dd>
                </div>
              )}
            </dl>
          </Block>
          <Block title="Condiciones comerciales">
            <p className="whitespace-pre-line text-[13px] text-fg-2">{version.conditions || "Se aplican las condiciones de cada producto."}</p>
          </Block>
          <Block title="Itinerario resumido">
            <QuoteItinerary blocks={version.itinerary ?? []} />
          </Block>
        </div>
      </SidePanel>
    </>
  );
}
