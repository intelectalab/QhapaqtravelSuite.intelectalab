"use client";

import { CircleCheck, CircleX, ClipboardList, Flag, PlaneTakeoff, Receipt, Send, UserRoundCog } from "lucide-react";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate } from "@/lib/format";
import type { Advisor } from "@/lib/leads";
import type { ReservationDetail, ReservationService } from "@/lib/reservations";
import { Step } from "./ReservationActions";

const LIFT = "transition-transform duration-300 hover:-translate-y-0.5";

const OPEN_SERVICE = ["pendiente", "solicitado"];

export function ReservationStateActions({ reservation }: { reservation: Pick<ReservationDetail, "code" | "can" | "travel_from"> }) {
  const { code, can } = reservation;
  return (
    <>
      {can.confirm && (
        <Step code={code} step="confirm" label="Confirmar reserva" icon={<CircleCheck size={16} />} variant="primary" title="Confirmar reserva" description="Se verifica que haya pasajeros y cupo en las salidas. Si la reserva no tiene cuotas, se crean el anticipo del 40 % y el saldo del 60 %." submitLabel="Confirmar" testId="action:confirm" />
      )}
      {can.start_operation && (
        <Step code={code} step="start_operation" label="Iniciar operación" icon={<PlaneTakeoff size={16} />} variant="primary" title="Iniciar operación" description={`El viaje empieza el ${formatDate(reservation.travel_from)}. La reserva pasa a En operación y Operaciones la sigue día a día.`} submitLabel="Iniciar operación" testId="action:start-operation" />
      )}
      {can.complete && (
        <Step code={code} step="complete" label="Completar viaje" icon={<Flag size={16} />} variant="primary" title="Completar viaje" description="La reserva queda completada y ya no admite cambios de pasajeros, servicios ni fechas." submitLabel="Completar viaje" testId="action:complete" />
      )}
    </>
  );
}

export function ReservationReassignAction({ reservation, advisors }: { reservation: Pick<ReservationDetail, "code" | "owner" | "owner_id">; advisors: Advisor[] }) {
  const choices = advisors.filter((advisor) => advisor.id !== reservation.owner_id).map((advisor) => ({ value: advisor.id, label: advisor.name }));
  return (
    <Step
      code={reservation.code}
      step="reassign"
      label="Reasignar"
      icon={<UserRoundCog size={16} />}
      title="Reasignar reserva"
      description={`Hoy la atiende ${reservation.owner.name}. El nuevo asesor la verá en su cartera.`}
      submitLabel="Reasignar"
      trigger={(open) => <Button iconOnly icon={<UserRoundCog size={16} />} label="Reasignar" onClick={open} data-testid="action:reassign" className={LIFT} />}
    >
      <SelectField label="Nuevo asesor" name="owner_id" options={choices} placeholder="Elegir" />
      <TextArea label="Motivo (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: vacaciones del asesor." />
    </Step>
  );
}

export function ReservationOrderAction({ code }: { code: string }) {
  return (
    <Step
      code={code}
      step="operation_order"
      label="Generar orden operativa"
      icon={<ClipboardList size={16} />}
      title="Generar orden operativa"
      description="Se crea la orden con sus tareas y una asignación por cada tour o traslado. Quedas como responsable; puedes cambiarlo desde Operaciones."
      submitLabel="Generar orden"
      trigger={(open) => <Button iconOnly icon={<ClipboardList size={16} />} label="Generar orden operativa" onClick={open} data-testid="action:operation-order" className={LIFT} />}
    />
  );
}

export function ReservationReceivablesAction({ code }: { code: string }) {
  return (
    <Step
      code={code}
      step="generate_receivables"
      label="Generar cuotas"
      icon={<Receipt size={15} />}
      title="Generar cuotas"
      description="Se crean el anticipo del 40 %, que vence en 3 días, y el saldo del 60 %, que vence 15 días antes del viaje."
      submitLabel="Generar cuotas"
      trigger={(open) => (
        <Button size="sm" variant="ghost" icon={<Receipt size={15} />} onClick={open} data-testid="action:generate-receivables">
          Generar
        </Button>
      )}
    />
  );
}

export function RequestPendingServicesAction({ code, count }: { code: string; count: number }) {
  return (
    <Step
      code={code}
      step="request_pending"
      label="Solicitar pendientes"
      icon={<Send size={15} />}
      title="Solicitar servicios pendientes"
      description={`Se envía la solicitud a los proveedores de ${count === 1 ? "1 servicio pendiente" : `${count} servicios pendientes`}. Los que no tienen proveedor activo se quedan pendientes.`}
      submitLabel="Enviar solicitudes"
      trigger={(open) => (
        <Button size="sm" variant="ghost" icon={<Send size={15} />} onClick={open} data-testid="action:request-pending">
          Solicitar pendientes
        </Button>
      )}
    />
  );
}

export function ServiceRowActions({ code, service, reasons }: { code: string; service: ReservationService; reasons: string[] }) {
  if (!OPEN_SERVICE.includes(service.status)) return null;
  const subject = service.provider ? `${service.name} · ${service.provider.name}` : service.name;
  return (
    <span className="flex flex-none gap-1.5">
      {service.status === "pendiente" &&
        (service.provider?.active ? (
          <Step code={code} step="service_request" formKey={`${service.code}-request`} label="Solicitar" icon={<Send size={15} />} title="Solicitar al proveedor" description={`${subject}. Le llega un correo con la fecha, la hora y los pasajeros.`} submitLabel="Enviar solicitud" trigger={(open) => <RowIcon tone="view" icon={<Send size={15} />} label="Solicitar al proveedor" onClick={open} testId={`order-service-request:${service.code}`} />}>
            <input type="hidden" name="service" value={service.code} />
            <TextArea label="Nota para el proveedor (opcional)" name="note" rows={2} maxLength={500} placeholder="Por ejemplo: grupo con dos niños." />
          </Step>
        ) : (
          <RowIcon tone="view" icon={<Send size={15} />} label="Solicitar al proveedor" disabledHint={service.provider ? "El proveedor no está activo" : "El servicio no tiene proveedor asignado"} />
        ))}
      <Step code={code} step="service_confirm" formKey={`${service.code}-confirm`} label="Confirmar" icon={<CircleCheck size={15} />} title="Registrar confirmación" description={subject} submitLabel="Registrar confirmación" trigger={(open) => <RowIcon tone="edit" icon={<CircleCheck size={15} />} label="Registrar confirmación" onClick={open} testId={`order-service-confirm:${service.code}`} />}>
        <input type="hidden" name="service" value={service.code} />
        <TextField label="Código de confirmación" name="confirmation_code" required minLength={4} maxLength={40} placeholder="El que dio el proveedor" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Hora (opcional)" name="time" type="time" defaultValue={service.time ?? ""} />
          <TextField label="Confirmó (opcional)" name="confirmed_by" maxLength={120} placeholder="Nombre de quien confirmó" />
        </div>
      </Step>
      <Step code={code} step="service_reject" formKey={`${service.code}-reject`} label="Rechazo" icon={<CircleX size={15} />} title="Registrar rechazo del proveedor" description={`${subject}. Si la reserva estaba confirmada, vuelve a pendiente de proveedor.`} submitLabel="Registrar rechazo" trigger={(open) => <RowIcon tone="delete" icon={<CircleX size={15} />} label="Registrar rechazo" onClick={open} />}>
        <input type="hidden" name="service" value={service.code} />
        <SelectField label="Motivo" name="reason" options={reasons.map((value) => ({ value, label: value }))} placeholder="Elegir" />
        <TextArea label="Detalle" name="detail" rows={3} required minLength={3} maxLength={500} placeholder="Qué respondió el proveedor." />
        <TextField label="Otra fecha que ofrece (opcional)" name="alternative_date" type="date" hint="Se crea un servicio nuevo pendiente en esa fecha." />
      </Step>
    </span>
  );
}
