"use client";

import { CalendarSync, CircleAlert, CircleCheck, Layers, Route } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { convertQuote, createAlternativeVersion, type ConvertState } from "@/app/(backoffice)/cotizaciones/actions";
import { CheckItem, type CheckTone } from "@/components/ui/CheckItem";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuoteConversion } from "@/lib/quotes";

const initial: ConvertState = { message: null, done: false };

const ITEM_TONE: Record<QuoteConversion["items"][number]["status"], CheckTone> = { disponible: "ok", proveedor: "warn", bloqueado: "bad" };

const shortDay = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");

async function closeOnly(): Promise<ConvertState> {
  return { message: null, done: true };
}

function Preconditions({ checks }: { checks: QuoteConversion["checks"] }) {
  const passed = checks.filter((check) => check.ok).length;
  return (
    <section className="flex flex-col gap-2" data-testid="quote-convert-checks">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13.5px] font-semibold">Precondiciones</h3>
        <span className={cn("text-[12.5px] font-semibold", passed === checks.length ? "text-ok" : "text-bad")}>
          {passed} de {checks.length} listas
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-[width] duration-700", passed === checks.length ? "bg-ok" : "bg-bad")} style={{ width: `${(passed / Math.max(1, checks.length)) * 100}%` }} />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {checks.map((check, index) => (
          <CheckItem key={check.key} compact tone={check.ok ? "ok" : "bad"} title={check.title} detail={check.detail} delay={index * 40} testId={`quote-convert-check-${check.key}`} />
        ))}
      </div>
    </section>
  );
}

export function QuoteConvertAction({ conversion, lockVersion, canVersion }: { conversion: QuoteConversion; lockVersion: number; canVersion: boolean }) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const blocked = conversion.blocked;
  const blockedItems = conversion.items.filter((item) => item.status === "bloqueado");
  const redatable = blockedItems.length > 0 && blockedItems.every((item) => item.alternatives.length > 0);
  const action = !blocked ? convertQuote : canVersion ? createAlternativeVersion : closeOnly;
  const submitLabel = !blocked ? "Convertir y confirmar reserva" : !canVersion ? "Entendido" : redatable ? "Crear versión con fecha alternativa" : "Crear nueva versión";

  return (
    <PanelAction<ConvertState>
      label="Convertir en reserva"
      icon={<Route size={16} />}
      variant="primary"
      formId={`quote-convert-${conversion.code}`}
      title="Convertir en reserva"
      description={`Se crea la reserva confirmada desde la versión ${conversion.version}, con sus servicios, ${conversion.pax} ${conversion.pax === 1 ? "pasajero por completar" : "pasajeros por completar"} y el plan de cobro. Se hace una sola vez.`}
      submitLabel={submitLabel}
      action={action}
      initial={initial}
      testId="quote-convert"
      confirmTestId="quote-convert-confirm"
      onDone={(state) => {
        if (state.reservation) router.push(`/reservas/${state.reservation}`);
        else if (state.version !== undefined || state.edit) router.push(`/cotizaciones/${conversion.code}${state.edit ? "?editar=1" : ""}`);
        router.refresh();
      }}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={conversion.code} />
          <input type="hidden" name="lock_version" value={lockVersion} />
          <input type="hidden" name="idempotency_key" value={key} />
          <input type="hidden" name="edit" value={redatable ? "0" : "1"} />

          <Preconditions checks={conversion.checks} />

          <section className="flex flex-col gap-2" data-testid="quote-convert-preview">
            <h3 className="text-[13.5px] font-semibold">Disponibilidad por ítem</h3>
            {conversion.items.map((item, index) => (
              <CheckItem key={item.line} tone={ITEM_TONE[item.status]} title={item.product} detail={`${formatDate(item.date)} · ${item.pax} pax · ${item.note}`} delay={index * 60} testId={`quote-convert-item-${item.line}`}>
                {item.status === "bloqueado" && item.alternatives.length > 0 && canVersion && (
                  <span className="mt-2 block" data-testid={`quote-convert-alternatives-${item.line}`}>
                    <ChoiceGroup
                      label="Salida alternativa"
                      name={`date_${item.line}`}
                      hint="Entre paréntesis, los cupos libres."
                      options={item.alternatives.slice(0, 4).map((alternative) => ({ value: alternative.date, label: `${shortDay(alternative.date)} (${alternative.free})` }))}
                    />
                  </span>
                )}
                {item.status === "bloqueado" && item.alternatives.length > 0 && !canVersion && (
                  <span className="mt-1 block text-[12.5px] text-fg-2">Salidas con cupo: {item.alternatives.map((alternative) => `${shortDay(alternative.date)} (${alternative.free})`).join(" · ")}</span>
                )}
                {item.status === "bloqueado" && item.alternatives.length === 0 && <span className="mt-1 block text-[12.5px] text-fg-2">No hay otra salida con cupo para {item.pax} pax.</span>}
              </CheckItem>
            ))}
          </section>

          {blocked ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-3.5 py-3 text-[13px]" data-testid="quote-convert-blocked">
              <CircleAlert size={16} className="mt-0.5 flex-none text-bad" />
              <span>
                <b className="block font-semibold text-bad">Conversión bloqueada</b>
                <span className="text-fg-2">
                  {blockedItems.length} {blockedItems.length === 1 ? "ítem no tiene" : "ítems no tienen"} disponibilidad y la reserva respeta la versión exacta.{" "}
                  {canVersion
                    ? redatable
                      ? "Se crea una nueva versión con la salida elegida y vuelve a necesitar la aprobación del cliente."
                      : "Crea una nueva versión, ajusta los ítems y vuelve a pedir la aprobación del cliente."
                    : "Pide a quien arma la cotización que cree una nueva versión con otra fecha."}
                </span>
              </span>
              {redatable && canVersion ? <CalendarSync size={16} className="ml-auto mt-0.5 flex-none text-fg-3" /> : <Layers size={16} className="ml-auto mt-0.5 flex-none text-fg-3" />}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--ok)_9%,transparent)] px-3.5 py-3 text-[13px]" data-testid="quote-convert-ready">
              <CircleCheck size={16} className="mt-0.5 flex-none text-ok" />
              <span className="text-fg-2">Disponibilidad verificada. Los servicios quedan pendientes de pedir al proveedor, se crean las cuotas por cobrar y la oportunidad pasa a ganada.</span>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13.5px] font-semibold">Plan de cobro</h3>
            <div className="grid grid-cols-2 gap-2">
              {conversion.receivables.map((receivable) => (
                <div key={receivable.concept} data-amount={receivable.amount} data-due={receivable.due} className="lift rounded-xl border border-line-2 bg-surface px-3.5 py-3">
                  <p className="text-[12px] text-fg-3">{receivable.concept}</p>
                  <p className="mt-0.5 text-[17px] font-bold tracking-[-0.02em]">{formatMoney(receivable.amount, conversion.currency)}</p>
                  <p className="text-[12px] text-fg-2">Vence el {formatDate(receivable.due)}</p>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-fg-3">Total {formatMoney(conversion.total, conversion.currency)}, con impuestos.</p>
          </section>

          {!blocked && <TextArea label="Nota para Operaciones (opcional)" name="notes" rows={3} maxLength={1000} placeholder="Por ejemplo: el cliente pidió habitación en primer piso." />}
        </>
      )}
    </PanelAction>
  );
}
