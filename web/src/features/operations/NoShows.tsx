"use client";

import { Ban, Pencil, Smartphone, UserX } from "lucide-react";
import Link from "next/link";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TextArea } from "@/components/ui/TextArea";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { NO_SHOW_SERVICE, type NoShow, type OrderDetail } from "@/lib/operations";
import { ConfirmNote, OpsStep, ToggleChips } from "./OpsStep";

type Service = OrderDetail["services"][number];

export function NoShowAction({ order, service }: { order: OrderDetail; service: Service }) {
  if (!NO_SHOW_SERVICE.includes(service.status) || service.replaced) return null;
  if (service.date > order.today) return <RowIcon tone="neutral" label="Registrar no-show" icon={<UserX size={15} />} disabledHint={`El no-show se registra desde el ${formatDate(service.date)}`} />;
  const assignment = order.assignments.find((item) => item.service_code === service.code);
  const present = new Set(assignment?.checked_in ?? []);
  const registered = new Set(order.no_shows.filter((item) => item.service.code === service.code).map((item) => item.passenger.id));
  const candidates = order.passengers.filter((passenger) => !present.has(passenger.id) && !registered.has(passenger.id));
  if (candidates.length === 0) return <RowIcon tone="neutral" label="Registrar no-show" icon={<UserX size={15} />} disabledHint="Todos los pasajeros tienen check-in o ya figuran como no-show" />;
  return (
    <OpsStep
      step="noshow_register"
      target={service.code}
      formKey={`${service.code}-noshow`}
      label="Registrar no-show"
      title="Pasajeros que no se presentaron"
      description={`${service.name} · ${formatDate(service.date)}`}
      submitLabel="Registrar no-show"
      trigger={(open) => <RowIcon tone="neutral" label="Registrar no-show" icon={<UserX size={15} />} onClick={open} />}
    >
      <ConfirmNote>Según Configuración › Operaciones, el registro puede avisar al asesor, abrir una incidencia o generar el cargo de la política del producto.</ConfirmNote>
      <ToggleChips label="No se presentaron" name="passenger_ids" options={candidates.map((passenger) => ({ value: passenger.id, label: passenger.full_name, hint: passenger.pax_type }))} hint={present.size > 0 ? `${present.size} con check-in no aparecen en la lista.` : undefined} />
      <TextArea label="Nota" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: no llegó al punto de encuentro." />
    </OpsStep>
  );
}

function NoShowEffects({ item }: { item: NoShow }) {
  const effects = [
    item.advisor_notified && <Badge key="advisor" tone="info" dot={false}>Asesor avisado</Badge>,
    item.incident && (
      <Link key="incident" href={`/operaciones/incidencias/${encodeURIComponent(item.incident)}`} className="hover:underline">
        <Badge tone="warn" dot={false}>{item.incident}</Badge>
      </Link>
    ),
    item.charge && (
      <Badge key="charge" tone={item.charge.status === "cancelada" ? "mute" : "bad"} dot={false}>
        Cargo {item.charge.pct} % · {formatMoney(item.charge.amount, item.charge.currency)}
      </Badge>
    ),
  ].filter(Boolean);
  return effects.length ? <span className="flex flex-wrap gap-1.5">{effects}</span> : null;
}

function NoShowRowActions({ item }: { item: NoShow }) {
  return (
    <span className="flex flex-none items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
      <OpsStep
        step="noshow_note"
        target={item.id}
        formKey={`${item.id}-note`}
        label="Editar nota"
        title="Nota del no-show"
        description={`${item.passenger.name} · ${item.service.name}`}
        submitLabel="Guardar nota"
        trigger={(open) => <RowIcon tone="edit" label="Editar nota" icon={<Pencil size={15} />} onClick={open} />}
      >
        <TextArea label="Nota" name="note" rows={3} maxLength={300} defaultValue={item.note ?? ""} />
      </OpsStep>
      <OpsStep
        step="noshow_void"
        target={item.id}
        formKey={`${item.id}-void`}
        label="Anular"
        title="Anular el no-show"
        description={`${item.passenger.name} · ${item.service.name}`}
        submitLabel="Anular registro"
        trigger={(open) => <RowIcon tone="delete" label="Anular no-show" icon={<Ban size={15} />} onClick={open} />}
      >
        <ConfirmNote tone="warn">{item.charge && item.charge.status !== "cancelada" ? `También se cancela la cuenta por cobrar ${item.charge.receivable} si no tiene pagos.` : "El registro queda anulado en el historial con su motivo."}</ConfirmNote>
        <TextArea label="Motivo" name="reason" rows={2} required minLength={3} maxLength={300} placeholder="Por ejemplo: el pasajero llegó tarde y sí tomó el servicio." />
      </OpsStep>
    </span>
  );
}

export function NoShowsCard({ order, editable }: { order: OrderDetail; editable: boolean }) {
  if (order.no_shows.length === 0) return null;
  return (
    <Card>
      <TintCardTitle
        icon={UserX}
        title="No se presentaron"
        tone="warn"
        aside={
          <span className="flex items-center gap-1.5">
            {order.no_shows.length}
            <InfoTip>Registros por pasajero de la tabla de no-show: los marca el operador al finalizar en la app o Operaciones desde esta orden.</InfoTip>
          </span>
        }
      />
      <ul className="flex flex-col gap-1">
        {order.no_shows.map((item, index) => (
          <li key={item.id} style={{ animationDelay: `${index * 50}ms` }} className="group flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
            <span className={cn("mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[10px]", item.source === "app_operador" ? "bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-info" : "bg-surface-2 text-fg-3")} title={item.source === "app_operador" ? "Desde la app del operador" : "Desde la web"}>
              {item.source === "app_operador" ? <Smartphone size={15} /> : <UserX size={15} />}
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="block truncate font-semibold">{item.passenger.name}</b>
              <span className="block truncate text-fg-3">
                {item.service.name} · {formatDate(item.service.date)} · {formatDateTime(item.recorded_at, false)}
                {item.recorded_by ? ` · ${item.recorded_by}` : ""}
              </span>
              {item.note && <span className="block text-fg-2">{item.note}</span>}
              <span className="mt-1 block">
                <NoShowEffects item={item} />
              </span>
            </span>
            {editable && <NoShowRowActions item={item} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
