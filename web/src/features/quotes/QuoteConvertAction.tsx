"use client";

import { CircleAlert, CircleCheck, Route } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { convertQuote, type ConvertState } from "@/app/(backoffice)/cotizaciones/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuoteConversion } from "@/lib/quotes";

const initial: ConvertState = { message: null, done: false };

export function QuoteConvertAction({ conversion, lockVersion }: { conversion: QuoteConversion; lockVersion: number }) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const blocked = conversion.items.some((item) => !item.ok);

  return (
    <PanelAction<ConvertState>
      label="Convertir en reserva"
      icon={<Route size={16} />}
      variant="primary"
      formId={`quote-convert-${conversion.code}`}
      title="Convertir en reserva"
      description={`Se crea la reserva confirmada con sus servicios, ${conversion.pax} ${conversion.pax === 1 ? "pasajero por completar" : "pasajeros por completar"} y el plan de cobro. Se hace una sola vez.`}
      submitLabel={blocked ? "Revisar disponibilidad" : "Crear reserva"}
      action={convertQuote}
      initial={initial}
      testId="quote-convert"
      confirmTestId="quote-convert-confirm"
      onDone={(state) => router.push(state.reservation ? `/reservas/${state.reservation}` : "/reservas")}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={conversion.code} />
          <input type="hidden" name="lock_version" value={lockVersion} />
          <input type="hidden" name="idempotency_key" value={key} />

          <section className="flex flex-col gap-2" data-testid="quote-convert-preview">
            <h3 className="text-[13.5px] font-semibold">Disponibilidad</h3>
            {conversion.items.map((item, index) => (
              <div
                key={item.line}
                style={{ animationDelay: `${index * 60}ms` }}
                className={cn("flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 rounded-xl px-3.5 py-3 text-[13px]", item.ok ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}
              >
                <span className={cn("mt-0.5 flex-none", item.ok ? "text-ok" : "text-bad")}>{item.ok ? <CircleCheck size={17} /> : <CircleAlert size={17} />}</span>
                <span className="min-w-0">
                  <b className="block font-semibold">{item.product}</b>
                  <span className="text-fg-2">
                    {formatDate(item.date)} · {item.pax} pax · {item.note}
                  </span>
                </span>
              </div>
            ))}
            {blocked && <p className="text-[12.5px] text-fg-3">No se convierte a medias. Crea una nueva versión con otra fecha y vuelve a pedir la aprobación del cliente.</p>}
          </section>

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

          <TextArea label="Nota para Operaciones (opcional)" name="notes" rows={3} maxLength={1000} placeholder="Por ejemplo: el cliente pidió habitación en primer piso." />
        </>
      )}
    </PanelAction>
  );
}
