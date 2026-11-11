"use client";

import { CircleAlert, LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { previewConfirm } from "@/app/(backoffice)/reservas/actions";
import { CheckItem } from "@/components/ui/CheckItem";
import { formatDate } from "@/lib/format";
import type { ConfirmPreview } from "@/lib/reservations";
import { ReservationRescheduleAction } from "./ReservationChangeActions";

function Check({ ok, title, detail, delay, children }: { ok: boolean; title: string; detail: string; delay: number; children?: React.ReactNode }) {
  return (
    <CheckItem tone={ok ? "ok" : "bad"} title={title} detail={detail} delay={delay}>
      {children}
    </CheckItem>
  );
}

export function ConfirmChecklist({ code }: { code: string }) {
  const [plan, setPlan] = useState<ConfirmPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    previewConfirm(code).then((result) => {
      if (!active) return;
      setPlan(result.plan);
      setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [code]);

  if (error) return <p className="text-[13px] text-bad">{error}</p>;
  if (!plan)
    return (
      <p className="flex items-center gap-2 text-[13px] text-fg-3">
        <LoaderCircle size={15} className="animate-spin" />
        Revisando la disponibilidad de cada servicio…
      </p>
    );

  return (
    <section className="flex flex-col gap-2" data-testid="confirm-checklist">
      {plan.services.map((service, index) => (
        <Check key={service.code} ok={service.ok} title={service.name} detail={`${formatDate(service.date)} · ${service.message}`} delay={index * 50}>
          {service.alternatives.length > 0 && (
            <span className="mt-1 block text-[12.5px] text-fg-2">
              Salidas con cupo: {service.alternatives.map((item) => `${item.ref} el ${formatDate(item.date)} (${item.free})`).join(" · ")}
            </span>
          )}
        </Check>
      ))}
      <Check ok={plan.passengers.ok} title="Pasajeros" detail={plan.passengers.ok ? `${plan.passengers.count} registrados.` : "Registra al menos un pasajero antes de confirmar."} delay={plan.services.length * 50} />
      {plan.blocked ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-3.5 py-3 text-[13px] text-bad">
          <span className="flex items-start gap-2">
            <CircleAlert size={16} className="mt-0.5 flex-none" />
            {plan.reschedule ? "Confirmación bloqueada: hay servicios sin cupo en su fecha. Reprograma el viaje a una fecha con disponibilidad." : "Confirmación bloqueada: resuelve los puntos marcados antes de confirmar."}
          </span>
          {plan.reschedule && (
            <span onSubmit={(event) => event.stopPropagation()}>
              <ReservationRescheduleAction code={code} labeled />
            </span>
          )}
        </div>
      ) : (
        <p className="flex items-start gap-2 text-[12.5px] text-fg-2">
          <Users size={15} className="mt-0.5 flex-none text-fg-3" />
          {plan.waiting ? "Hay servicios esperando al proveedor: la reserva queda pendiente de proveedor hasta que respondan." : "Todo listo. Si la reserva no tiene cuotas, se crean el anticipo y el saldo según las políticas comerciales."}
        </p>
      )}
    </section>
  );
}
