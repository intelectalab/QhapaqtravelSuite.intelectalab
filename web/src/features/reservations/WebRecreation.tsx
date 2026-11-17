"use client";

import { ArrowRight, CalendarSync, CopyPlus, Link2, Ticket } from "lucide-react";
import Link from "next/link";
import { recreateWebReservation } from "@/app/(backoffice)/reservas/recreation-actions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

export interface WebRecreationPreview {
  eligible: boolean;
  reason: string | null;
  order: string | null;
  replaced_by: string | null;
  cancel_reason: string | null;
  amount: string;
  currency: string;
  payments: { code: string; amount: string; currency: string; reference: string | null; reason: string | null }[];
  seats_available: boolean;
  seats: { departure: string; date: string; needed: number; free: number }[];
  outcome: "confirmada" | "pendiente_disponibilidad";
}

const INITIAL: StepResult = { message: null, done: false };

export function ReservationReplacement({ replaces, replacedBy }: { replaces?: string | null; replacedBy?: string | null }) {
  const target = replacedBy ?? replaces;
  if (!target) return null;
  return (
    <Link
      href={`/reservas/${encodeURIComponent(target)}`}
      className="lift group mb-5 flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-[13.5px]"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-info">
        <Link2 size={16} />
      </span>
      <span className="min-w-0 flex-1 text-fg-2">
        <b className="font-semibold text-fg">{replacedBy ? `Reemplazada por ${replacedBy}` : `Reemplaza a ${replaces}`}</b>
        {replacedBy ? " · El pago llegó después de la cancelación y se recreó con los mismos datos." : " · Se creó con los mismos datos porque el pago llegó después de la cancelación."}
      </span>
      <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function WebRecreationCard({ code, preview }: { code: string; preview: WebRecreationPreview }) {
  if (!preview.eligible) return null;
  const confirmed = preview.outcome === "confirmada";
  return (
    <section className="lift mb-5 flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-4 rounded-card border border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[color-mix(in_srgb,var(--info)_7%,var(--surface))] px-4 py-3.5">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-info">
        <CopyPlus size={18} />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px]">
        <b className="block font-semibold text-fg">¿El dinero sí llegó?</b>
        <span className="text-fg-2">
          Pedido {preview.order} · {formatMoney(preview.amount, preview.currency)} informado{preview.payments[0]?.reference ? ` con la operación ${preview.payments[0].reference}` : ""}.
        </span>
      </span>
      <Badge tone={preview.seats_available ? "ok" : "warn"}>{preview.seats_available ? "Hay cupos libres" : "Sin cupos en la salida"}</Badge>
      <PanelAction<StepResult>
        label="Recrear la reserva"
        icon={<CopyPlus size={15} />}
        formId={`web-recreation-${code}`}
        title="Recrear la reserva"
        description={`${code} sigue cancelada. Se crea una reserva nueva con los mismos datos y el pago que llegó, enlazada a esta. Queda en la auditoría y el cliente recibe un correo.`}
        submitLabel="Recrear la reserva"
        action={recreateWebReservation}
        initial={INITIAL}
      >
        {() => (
          <>
            <input type="hidden" name="code" value={code} />
            {preview.seats.length > 0 && (
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
            )}
            <p className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2">
              {confirmed ? <CopyPlus size={15} className="mt-0.5 flex-none text-ok" /> : <CalendarSync size={15} className="mt-0.5 flex-none text-warn" />}
              <span>
                <b className="font-semibold text-fg">{confirmed ? "Quedará confirmada" : "Quedará pendiente de disponibilidad"}</b>
                {confirmed ? ": recupera los mismos cupos y el pago se valida y se aplica." : ": el pago se valida y se aplica; desde la reserva nueva la reprogramas a otra fecha o devuelves el dinero."}
              </span>
            </p>
            <TextArea label="Nota (opcional)" name="note" rows={3} maxLength={300} placeholder="Ejemplo: el banco acreditó el abono al día siguiente" />
          </>
        )}
      </PanelAction>
    </section>
  );
}
