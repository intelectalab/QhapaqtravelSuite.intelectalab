"use client";

import { CheckCircle2, Clock, ScrollText, XCircle } from "lucide-react";
import Link from "next/link";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortalQuoteSummary } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";
import { EmptyLine, PortalBadge, PortalTitle, RISE, rise } from "./PortalUi";

export function PortalQuotes({ quotes }: { quotes: PortalQuoteSummary[] }) {
  const open = quotes.filter((quote) => quote.can_decide);
  const accepted = quotes.filter((quote) => ["aprobada", "convertida"].includes(quote.status));
  const closed = quotes.filter((quote) => !quote.can_decide && !accepted.includes(quote));

  return (
    <>
      <PortalTitle title="Propuestas" subtitle="Las cotizaciones que tu asesor preparó para ti. Acéptalas o cuéntanos qué cambiar." />
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <TintTile icon={Clock} tone="violet" label="Por responder" value={open.length} note={open.length ? "Esperan tu decisión" : "Nada pendiente"} />
        <TintTile icon={CheckCircle2} tone="ok" label="Aceptadas" value={accepted.length} note={`${accepted.filter((quote) => quote.status === "convertida").length} ya convertidas en viaje`} />
        <TintTile icon={XCircle} tone="mute" label="Cerradas" value={closed.length} note="No aceptadas o vencidas" />
      </section>
      {quotes.length === 0 ? (
        <EmptyLine>Todavía no recibiste propuestas. Escríbele a tu asesor para cotizar tu próximo viaje.</EmptyLine>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {quotes.map((quote, index) => (
            <li key={quote.code} style={rise(index)} className={RISE}>
              <Link
                href={`/portal/propuestas/${quote.code}`}
                style={toneStyle(quote.can_decide ? "violet" : accepted.includes(quote) ? "ok" : "mute")}
                className={cn("lift group relative flex h-full flex-col gap-3 overflow-hidden rounded-card border bg-surface p-4 shadow-card", quote.can_decide ? "border-[color-mix(in_srgb,var(--tint)_40%,transparent)]" : "border-line")}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--tint)] transition-[width] duration-300 group-hover:w-1.5" />
                <div className="flex items-start justify-between gap-3 pl-1">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <ScrollText size={18} className="mt-0.5 flex-none text-[var(--tint)]" />
                    <span className="min-w-0">
                      <b className="block text-[14.5px] font-semibold leading-snug">{quote.title}</b>
                      <span className="text-[12px] text-fg-3">
                        {quote.code} · versión {quote.version}
                      </span>
                    </span>
                  </span>
                  <PortalBadge status={quote.expired ? "vencida" : quote.status} />
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 pl-1 text-[12.5px] text-fg-2">
                  <span>
                    {quote.travel_from ? `Viaje desde el ${formatDate(quote.travel_from)}` : "Fechas por definir"}
                    {quote.valid_until && quote.can_decide && <span className="block font-semibold text-[var(--tint)]">Válida hasta el {formatDate(quote.valid_until)}</span>}
                  </span>
                  {quote.total !== null && <b className="text-[16px] tracking-tight text-fg">{formatMoney(quote.total, quote.currency)}</b>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
