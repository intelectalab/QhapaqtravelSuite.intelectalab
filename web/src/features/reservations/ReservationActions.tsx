"use client";

import { Ban, CircleX, Pencil, Plus, ShieldQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { reservationStep, type ReservationState } from "@/app/(backoffice)/reservas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { amountAttr, formatDate, formatMoney } from "@/lib/format";
import { ReservationLockInput } from "./ReservationLock";
import { PAX_TYPE, RELATIONSHIPS, type ReservationCancellation, type ReservationDetail, type ReservationPassenger } from "@/lib/reservations";

const initial: ReservationState = { message: null, done: false };

interface StepProps {
  code: string;
  step: string;
  label: string;
  icon: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  trigger?: (open: () => void) => ReactNode;
  defaultOpen?: boolean;
  formKey?: string;
  onDone?: () => void;
  testId?: string;
  confirmTestId?: string;
  children?: ReactNode;
}

export function Step({ code, step, label, icon, variant = "secondary", title, description, submitLabel, trigger, defaultOpen, formKey, onDone, testId, confirmTestId, children }: StepProps) {
  const router = useRouter();
  return (
    <PanelAction<ReservationState>
      label={label}
      icon={icon}
      variant={variant}
      formId={`reservation-${step}-${formKey ?? code}`}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={reservationStep}
      initial={initial}
      trigger={trigger}
      defaultOpen={defaultOpen}
      onDone={onDone ?? (() => router.refresh())}
      testId={testId}
      confirmTestId={confirmTestId}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="step" value={step} />
          <ReservationLockInput />
          {children}
        </>
      )}
    </PanelAction>
  );
}

export function ReservationEditAction({ reservation, defaultOpen }: { reservation: ReservationDetail; defaultOpen?: boolean }) {
  return (
    <Step code={reservation.code} step="update" label="Editar" icon={<Pencil size={16} />} title="Editar reserva" description={`${reservation.title} · ${reservation.code}`} submitLabel="Guardar cambios" defaultOpen={defaultOpen}>
      <TextArea label="Notas para Operaciones" name="notes" rows={5} maxLength={2000} defaultValue={reservation.notes ?? ""} placeholder="Pedidos especiales, horarios de vuelo, alergias del grupo." />
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Para cambiar fechas, servicios o número de pasajeros con su impacto en el precio, usa Modificar o Reprogramar cuando estén disponibles.</p>
    </Step>
  );
}

function PassengerFields({ passenger }: { passenger?: ReservationPassenger }) {
  const [lead, setLead] = useState(passenger?.is_lead ?? false);
  return (
    <>
      <TextField label="Nombre completo" name="full_name" required minLength={3} maxLength={150} defaultValue={passenger && !passenger.is_placeholder ? passenger.full_name : ""} placeholder="Como figura en su documento" />
      <ChoiceGroup label="Tipo" name="pax_type" options={Object.entries(PAX_TYPE).map(([value, label]) => ({ value, label }))} defaultValue={passenger?.pax_type ?? "ADT"} />
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
        <SelectField label="Documento" name="doc_type" options={[{ value: "DNI", label: "DNI" }, { value: "Pasaporte", label: "Pasaporte" }, { value: "CE", label: "Carné de extranjería" }]} defaultValue={passenger?.doc_type ?? ""} placeholder="Elegir" />
        <TextField label="Número" name="doc_number" maxLength={30} defaultValue={passenger?.doc_number ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nacimiento" name="birth_date" type="date" defaultValue={passenger?.birth_date ?? ""} />
        <TextField label="Nacionalidad" name="nationality" maxLength={60} defaultValue={passenger?.nationality ?? ""} placeholder="Peruana" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Teléfono" name="phone" maxLength={30} defaultValue={passenger?.phone ?? ""} />
        <TextField label="Correo" name="email" type="email" maxLength={150} defaultValue={passenger?.email ?? ""} />
      </div>
      <SelectField label="Relación con el titular" name="relationship" options={RELATIONSHIPS.map((value) => ({ value, label: value }))} defaultValue={passenger?.relationship ?? ""} placeholder="Elegir" />
      <TextField label="Alimentación o salud (opcional)" name="diet_notes" maxLength={200} defaultValue={passenger?.diet_notes ?? ""} placeholder="Vegetariano, alergia al maní…" />
      <SwitchField label="Es el titular de la reserva" hint="Recibe las comunicaciones del viaje." name="is_lead" checked={lead} onCheckedChange={setLead} />
    </>
  );
}

export function PassengerAddAction({ code }: { code: string }) {
  return (
    <Step code={code} step="passenger" formKey={`${code}-new`} label="Agregar" icon={<Plus size={15} />} title="Agregar pasajero" submitLabel="Agregar pasajero" trigger={(open) => <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={open}>Agregar</Button>}>
      <PassengerFields />
    </Step>
  );
}

export function PassengerRowActions({ code, passenger, canRemove }: { code: string; passenger: ReservationPassenger; canRemove: boolean }) {
  return (
    <span className="flex flex-none gap-1.5">
      <Step code={code} step="passenger" formKey={passenger.id} label="Editar" icon={<Pencil size={15} />} title={passenger.is_placeholder ? "Completar pasajero" : "Editar pasajero"} description={passenger.full_name} submitLabel="Guardar" trigger={(open) => <RowIcon tone="edit" label={passenger.is_placeholder ? "Completar datos" : "Editar"} onClick={open} />}>
        <input type="hidden" name="passenger" value={passenger.id} />
        <PassengerFields passenger={passenger} />
      </Step>
      {canRemove ? (
        <Step code={code} step="remove_passenger" formKey={`${passenger.id}-remove`} label="Quitar" icon={<CircleX size={15} />} title="Quitar pasajero" description={`${passenger.full_name} deja de figurar en la reserva. El precio no cambia: para eso usa Modificar.`} submitLabel="Quitar" trigger={(open) => <RowIcon tone="delete" label="Quitar" onClick={open} />}>
          <input type="hidden" name="passenger" value={passenger.id} />
        </Step>
      ) : (
        <RowIcon tone="delete" label="Quitar" disabledHint="La reserva necesita al menos un pasajero" />
      )}
    </span>
  );
}

function CancelSummary({ preview }: { preview: ReservationCancellation }) {
  const money = (value: string) => formatMoney(value, preview.currency);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-[13.5px] font-semibold">Penalidad por servicio</h3>
        {preview.lines.map((line, index) => (
          <div key={line.code} style={{ animationDelay: `${index * 50}ms` }} className="flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{line.name}</b>
              <span className="text-fg-3">
                {formatDate(line.date)} · {line.days < 0 ? "ya pasó" : line.days === 0 ? "es hoy" : `faltan ${line.days} días`}
              </span>
            </span>
            <span className={cn("flex-none rounded-full px-2 py-0.5 text-[12px] font-semibold", line.pct === 0 ? "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-bad")}>{line.pct} %</span>
          </div>
        ))}
        {preview.lines[0] && <p className="text-[12px] text-fg-3">Política: {preview.lines[0].policy}</p>}
      </section>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "cancellation-penalty", label: "Penalidad", value: preview.penalty, tone: Number(preview.penalty) > 0 ? "text-bad" : "text-fg" },
          { id: "cancellation-paid", label: "Pagado", value: preview.paid, tone: "text-fg" },
          { id: "cancellation-refund", label: Number(preview.refund) > 0 ? "Se reembolsa" : "Queda por cobrar", value: Number(preview.refund) > 0 ? preview.refund : preview.owed, tone: Number(preview.refund) > 0 ? "text-ok" : Number(preview.owed) > 0 ? "text-bad" : "text-fg" },
        ].map((item) => (
          <div key={item.label} className="lift rounded-xl border border-line-2 bg-surface px-3 py-2.5">
            <p className="text-[12px] text-fg-3">{item.label}</p>
            <p data-testid={item.id} data-amount={amountAttr(item.value)} className={cn("mt-0.5 text-[16px] font-bold tracking-[-0.02em]", item.tone)}>{money(item.value)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReservationCancelAction({ reservation, preview, defaultOpen }: { reservation: ReservationDetail; preview: ReservationCancellation; defaultOpen?: boolean }) {
  const requested = preview.request ? preview.request.split(": ") : null;
  return (
    <Step
      code={reservation.code}
      step="cancel"
      label="Cancelar reserva"
      icon={<Ban size={16} />}
      title="Cancelar reserva"
      description="Se liberan los cupos, se cancelan los servicios y las cuotas pendientes. No se puede deshacer."
      submitLabel="Cancelar reserva"
      defaultOpen={defaultOpen}
      confirmTestId="cancellation-confirm"
      trigger={(open) => <Button iconOnly icon={<Ban size={16} />} label="Cancelar reserva" onClick={open} data-testid="reservation-cancel" className="transition-transform duration-300 hover:-translate-y-0.5" />}
    >
      <CancelSummary preview={preview} />
      <SelectField label="Motivo" name="reason" options={preview.reasons.map((value) => ({ value, label: value }))} defaultValue={requested?.[0] ?? ""} placeholder="Elegir" />
      <TextArea label="Detalle" name="detail" rows={3} required minLength={3} maxLength={500} defaultValue={requested?.slice(1).join(": ") ?? ""} placeholder="Qué pasó y quién lo pidió." />
    </Step>
  );
}

export function ReservationRequestCancelAction({ reservation, preview, defaultOpen }: { reservation: ReservationDetail; preview: ReservationCancellation; defaultOpen?: boolean }) {
  return (
    <Step code={reservation.code} step="request_cancel" label="Solicitar anulación" icon={<ShieldQuestion size={16} />} title="Solicitar anulación" description="Gerencia revisa y procesa la cancelación. Mientras tanto, la reserva sigue vigente." submitLabel="Enviar solicitud" defaultOpen={defaultOpen}>
      <CancelSummary preview={preview} />
      <SelectField label="Motivo" name="reason" options={preview.reasons.map((value) => ({ value, label: value }))} placeholder="Elegir" />
      <TextArea label="Detalle" name="detail" rows={3} required minLength={3} maxLength={500} placeholder="Qué pidió el cliente." />
    </Step>
  );
}

export function ReservationRejectRequestAction({ code, request }: { code: string; request: string }) {
  return (
    <Step code={code} step="reject_request" label="No anular" icon={<CircleX size={15} />} variant="ghost" title="Rechazar la solicitud de anulación" description="La reserva sigue vigente y se avisa a quien la pidió." submitLabel="Rechazar solicitud">
      <input type="hidden" name="request" value={request} />
      <TextArea label="Motivo" name="note" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: el cliente confirmó que viaja." />
    </Step>
  );
}
