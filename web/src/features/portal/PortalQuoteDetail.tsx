"use client";

import { CalendarDays, Check, CheckCircle2, ListChecks, MessageSquareText, ScrollText, ShieldCheck, Users, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { HeroBand, HeroChip, HeroPanel, ToneScope } from "@/components/ui/Tinted";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { approveQuote, rejectQuote } from "@/app/(portal)/portal/actions";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { REJECT_REASONS, type PortalQuote } from "@/lib/portal";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { toneStyle } from "@/lib/tone";
import { AdvisorCard, EmptyLine, PortalBadge, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

function ApprovePanel({ quote, clientName }: { quote: PortalQuote; clientName: string }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <PanelAction
      label="Aceptar propuesta"
      icon={<Check size={16} />}
      variant="primary"
      title="Aceptar propuesta"
      description={`${quote.title} · ${quote.total !== null ? formatMoney(quote.total, quote.currency) : ""}`}
      submitLabel="Aceptar y reservar"
      action={approveQuote.bind(null, quote.code)}
      initial={initial}
    >
      {() => (
        <>
          <p style={toneStyle("ok")} className="flex items-start gap-2 rounded-tile bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-3.5 py-3 text-[13px] text-fg-2">
            <ShieldCheck size={17} className="mt-0.5 flex-none text-[var(--tint)]" />
            Guardamos la fecha, la hora y la versión que apruebas como constancia. Tu asesor confirmará los servicios y te enviará el detalle de pagos.
          </p>
          <input type="hidden" name="lock_version" value={quote.lock_version} />
          <TextField label="Nombre de quien aprueba" name="name" defaultValue={clientName} required maxLength={150} />
          <SwitchField label="Acepto las condiciones de la propuesta" name="accept" checked={accepted} onCheckedChange={setAccepted} hint={`Versión ${quote.version ?? 1}, válida hasta el ${quote.valid_until ? formatDate(quote.valid_until) : "—"}.`} />
          <TextArea label="Comentario para tu asesor" name="comment" rows={3} maxLength={500} placeholder="Opcional" />
        </>
      )}
    </PanelAction>
  );
}

function RejectPanel({ quote }: { quote: PortalQuote }) {
  return (
    <PanelAction label="No me interesa" icon={<X size={16} />} title="Responder a la propuesta" description="Tu respuesta ayuda a tu asesor a preparar una mejor opción." submitLabel="Enviar respuesta" action={rejectQuote.bind(null, quote.code)} initial={initial}>
      {() => (
        <>
          <input type="hidden" name="lock_version" value={quote.lock_version} />
          <SelectField label="Motivo" name="reason" placeholder="Elige un motivo" options={REJECT_REASONS.map((reason) => ({ value: reason, label: reason }))} />
          <TextArea label="Cuéntanos un poco más" name="comment" rows={4} required minLength={3} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

export function PortalQuoteDetail({ quote, clientName }: { quote: PortalQuote; clientName: string }) {
  const pax = quote.pax.adults + quote.pax.children + quote.pax.infants;
  const tone = quote.can_decide ? "violet" : quote.approval ? "ok" : "t3";
  return (
    <div className="flex flex-col gap-5">
      <Link href="/portal/propuestas" className="w-fit text-[12.5px] font-semibold text-fg-3 transition hover:text-t1">
        ← Propuestas
      </Link>
      <ToneScope tone={tone}>
        <HeroBand className="mb-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white/75">
                Propuesta {quote.code} · versión {quote.version ?? 1}
              </p>
              <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[30px]">{quote.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {quote.travel_from && (
                  <HeroChip icon={<CalendarDays size={14} />}>
                    {formatDate(quote.travel_from)}
                    {quote.travel_to ? ` – ${formatDate(quote.travel_to)}` : ""}
                  </HeroChip>
                )}
                <HeroChip icon={<Users size={14} />}>
                  {pax} {pax === 1 ? "viajero" : "viajeros"}
                  {quote.pax.children ? ` · ${quote.pax.children} ${quote.pax.children === 1 ? "niño" : "niños"}` : ""}
                </HeroChip>
              </div>
            </div>
            <HeroPanel solid>
              <p className="text-[12.5px] font-semibold text-fg-3">Total de la propuesta</p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight text-[var(--tint)]">{quote.total !== null ? formatMoney(quote.total, quote.currency) : "—"}</p>
              <p className="mt-1.5 text-[12.5px] text-fg-2">{quote.tax ? `Incluye impuestos por ${formatMoney(quote.tax, quote.currency)}` : "Impuestos incluidos"}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <PortalBadge status={quote.status} />
                <DownloadButton href={`/portal/propuestas/${quote.code}/pdf`} label="Descargar PDF" size="sm" />
              </div>
            </HeroPanel>
          </div>
        </HeroBand>
      </ToneScope>

      {quote.can_decide && (
        <div style={toneStyle("violet")} className={cn("flex flex-wrap items-center justify-between gap-3 rounded-card border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-5 py-4", RISE)}>
          <p className="text-[13.5px]">
            <b className="font-semibold">¿Te gusta esta propuesta?</b> <span className="text-fg-2">Acéptala antes del {quote.valid_until ? formatDate(quote.valid_until) : "vencimiento"} para asegurar precios y espacios.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <RejectPanel quote={quote} />
            <ApprovePanel quote={quote} clientName={clientName} />
          </div>
        </div>
      )}
      {quote.approval && (
        <p style={toneStyle("ok")} className="flex items-center gap-2 rounded-card bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-5 py-3.5 text-[13.5px] font-medium text-[var(--tint)]">
          <CheckCircle2 size={17} /> Aceptada por {quote.approval.by} el {formatDateTime(quote.approval.at)} · {quote.approval.channel}
        </p>
      )}
      {quote.rejection && (
        <p className="flex items-center gap-2 rounded-card bg-surface-2 px-5 py-3.5 text-[13.5px] text-fg-2">
          <XCircle size={17} /> No aceptada el {formatDateTime(quote.rejection.at)} · {quote.rejection.reason}
        </p>
      )}
      {!quote.can_decide && quote.status === "vencida" && <EmptyLine>Esta propuesta venció. Pide a tu asesor una versión actualizada desde Mensajes.</EmptyLine>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={ListChecks} title="Qué incluye" aside={quote.items.length}>
            {quote.items.length === 0 ? (
              <EmptyLine>Tu asesor está completando el detalle.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {quote.items.map((item, index) => (
                  <li key={item.line} style={rise(index)} className={cn("lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-3", RISE)}>
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] text-[12px] font-bold text-t1">{item.line}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13.5px] font-semibold">{item.name}</b>
                      <span className="text-[12px] text-fg-3">
                        {item.date ? `${formatDate(item.date)} · ` : ""}
                        {item.pax} {item.pax === 1 ? "persona" : "personas"}
                        {item.segment && item.segment !== item.name ? ` · ${item.segment}` : ""}
                      </span>
                    </span>
                    <b className="flex-none text-[13.5px]">{formatMoney(item.total, quote.currency)}</b>
                  </li>
                ))}
              </ul>
            )}
            {quote.discount ? <p className="mt-3 text-right text-[12.5px] text-ok">Descuento aplicado: {formatMoney(quote.discount, quote.currency)}</p> : null}
          </SectionCard>
          <SectionCard icon={ScrollText} title="Condiciones">
            {quote.conditions ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2">{quote.conditions}</p> : <p className="text-[13px] text-fg-3">Aplican las políticas de reserva y cancelación de la agencia. Tu asesor puede enviártelas por Mensajes.</p>}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <AdvisorCard advisor={quote.advisor} />
          <Button href="/portal/mensajes" variant="secondary" icon={<MessageSquareText size={16} />}>
            Pedir un cambio
          </Button>
        </div>
      </div>
    </div>
  );
}
