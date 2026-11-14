"use client";

import { CalendarSync, CircleDollarSign, RotateCcw, Ticket } from "lucide-react";
import { reactivateWebReservation } from "@/app/(backoffice)/reservas/reactivation-actions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

export interface WebReactivationPreview {
  eligible: boolean;
  reason: string | null;
  order: string | null;
  cancel_reason: string | null;
  amount: string;
  currency: string;
  payments: { code: string; amount: string; currency: string; reference: string | null; reason: string | null }[];
  seats_available: boolean;
  seats: { departure: string; date: string; needed: number; free: number }[];
  modes: { value: "reactivar" | "reprogramar" | "devolver"; label: string }[];
}

const INITIAL: StepResult = { message: null, done: false };

const MODE_HINT: Record<string, string> = {
  reactivar: "La reserva vuelve con sus cupos, el pago se valida y se aplica, y el cliente recibe un correo.",
  reprogramar: "El pago se valida y la reserva queda pendiente de disponibilidad para elegir otra fecha con «Reprogramar».",
  devolver: "El pago se valida y queda un reembolso pendiente en Finanzas › Pagos. La reserva sigue cancelada.",
};

export function WebReactivationCard({ code, preview }: { code: string; preview: WebReactivationPreview }) {
  if (!preview.eligible) return null;
  return (
    <section className="lift mb-5 flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-4 rounded-card border border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[color-mix(in_srgb,var(--info)_7%,var(--surface))] px-4 py-3.5">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-info">
        <RotateCcw size={18} />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px]">
        <b className="block font-semibold text-fg">¿El dinero sí llegó?</b>
        <span className="text-fg-2">
          Pedido {preview.order} · {formatMoney(preview.amount, preview.currency)} informado{preview.payments[0]?.reference ? ` con la operación ${preview.payments[0].reference}` : ""}.
        </span>
      </span>
      <Badge tone={preview.seats_available ? "ok" : "warn"}>{preview.seats_available ? "Hay cupos libres" : "Sin cupos en la salida"}</Badge>
      <PanelAction<StepResult>
        label={preview.seats_available ? "Reactivar" : "Resolver el pago"}
        icon={<RotateCcw size={15} />}
        formId={`web-reactivation-${code}`}
        title="Reactivar la reserva web"
        description="Úsalo cuando el abono sí figura en el banco. Queda en la auditoría y el cliente recibe un correo."
        submitLabel="Confirmar"
        action={reactivateWebReservation}
        initial={INITIAL}
      >
        {() => (
          <>
            <input type="hidden" name="code" value={code} />
            <ul className="grid gap-2">
              {preview.seats.map((seat) => (
                <li key={seat.departure} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
                  <span className="inline-flex items-center gap-2">
                    <Ticket size={15} className="text-fg-3" />
                    Salida {seat.departure} · {formatDate(seat.date)}
                  </span>
                  <span className={seat.free >= seat.needed ? "font-semibold text-ok" : "font-semibold text-bad"}>
                    {seat.free} libres de {seat.needed}
                  </span>
                </li>
              ))}
            </ul>
            <ChoiceGroup label="Qué hacer" name="mode" options={preview.modes} defaultValue={preview.modes[0]?.value} />
            <div className="grid gap-1.5 text-[12.5px] text-fg-3">
              {preview.modes.map((mode) => (
                <p key={mode.value} className="flex items-start gap-2">
                  {mode.value === "devolver" ? <CircleDollarSign size={14} className="mt-0.5 flex-none" /> : mode.value === "reprogramar" ? <CalendarSync size={14} className="mt-0.5 flex-none" /> : <RotateCcw size={14} className="mt-0.5 flex-none" />}
                  <span>
                    <b className="font-semibold text-fg-2">{mode.label}:</b> {MODE_HINT[mode.value]}
                  </span>
                </p>
              ))}
            </div>
            <TextArea label="Nota (opcional)" name="note" rows={3} maxLength={300} placeholder="Ejemplo: el banco acreditó el abono al día siguiente" />
          </>
        )}
      </PanelAction>
    </section>
  );
}
