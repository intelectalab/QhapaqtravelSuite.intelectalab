"use client";

import { ArrowRight, Ban, Check, CircleCheckBig, ClipboardCheck, Plus, Trash2, TriangleAlert, Truck, UserCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { opsStep } from "@/app/(backoffice)/operaciones/actions";
import { previewAssignment } from "@/app/(backoffice)/operaciones/assignment-preview";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Assignment, AssignmentPreview, CloseCheck, OrderDetail, ResourceOptions } from "@/lib/operations";
import { ConfirmNote, OpsStep, ToggleChips } from "./OpsStep";

const NEXT_NOTE: Record<string, string> = {
  pendiente_asignacion: "La orden queda lista para asignar guías, conductores y vehículos.",
  asignada: "Todos los servicios deben tener al menos un recurso asignado.",
  confirmada: "Los recursos confirmaron su participación y los proveedores confirmaron cada servicio.",
  en_ejecucion: "La reserva pasa a «En operación» y el equipo de campo puede iniciar los servicios.",
  completada: "Se cierra la orden y la reserva pasa a «Completada». Los costos quedan listos para liquidación.",
};

export function useQuickStep() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fields: Record<string, string>) =>
    start(async () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      const result = await opsStep({ message: null, done: false }, form);
      setError(result.done ? null : result.message);
      if (result.done) router.refresh();
    });
  return { run, pending, error };
}

export function QuickError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-2 animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-xl bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-3 py-2 text-[12.5px] text-bad">{message}</p>;
}

export const CLOSE_REMEDY: Record<string, string> = {
  services: "Marca como completado cada servicio en «Servicios y proveedores» cuando ya se prestó.",
  incidents: "Resuelve o cierra las incidencias abiertas o en proceso.",
  evidence: "Sube al menos una evidencia de la orden; cada incidencia alta o crítica necesita la suya.",
  costs: "Carga el costo de proveedor de cada servicio en la reserva.",
};

export function CloseChecklist({ checks, detailed = false }: { checks: CloseCheck[]; detailed?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <li key={check.id} className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px]", check.ok ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]")}>
          <span className={cn("grid h-6 w-6 flex-none place-items-center rounded-full text-white", check.ok ? "bg-ok" : "bg-bad")}>{check.ok ? <Check size={13} strokeWidth={3} /> : "!"}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <b className="font-medium">{check.label}</b>
              <span className="text-xs text-fg-3">{check.detail}</span>
            </span>
            {detailed && !check.ok && CLOSE_REMEDY[check.id] && <span className="mt-0.5 block text-[12.5px] text-fg-2">{CLOSE_REMEDY[check.id]}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OrderAdvanceActions({ order, checks }: { order: Pick<OrderDetail, "code" | "lock_version" | "title" | "transitions" | "can">; checks: CloseCheck[] }) {
  return (
    <>
      {order.transitions.map((transition) => {
        const closing = transition.status === "completada";
        if (closing && !order.can.close) return null;
        const missing = closing ? checks.filter((check) => !check.ok) : [];
        const blocked = missing.length > 0;
        const icon = closing ? <CircleCheckBig size={16} /> : <ArrowRight size={16} />;
        return (
          <OpsStep
            key={transition.status}
            step="order_status"
            target={order.code}
            version={order.lock_version}
            formKey={`${order.code}-${transition.status}`}
            label={transition.label}
            icon={icon}
            variant="primary"
            title={transition.label}
            description={`${order.title} · ${order.code}`}
            submitLabel={transition.label}
            trigger={
              blocked
                ? (open) => (
                    <span className="inline-flex items-center gap-1.5">
                      <Button variant="secondary" icon={icon} iconOnlyOnMobile onClick={open}>
                        {transition.label}
                        <span className="ml-1 rounded-full bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] px-2 py-0.5 text-[11.5px] font-semibold text-bad">{missing.length === 1 ? "Falta 1 condición" : `Faltan ${missing.length} condiciones`}</span>
                      </Button>
                      <InfoTip label="Qué falta para cerrar">
                        <b className="mb-1.5 block text-fg">Para cerrar la operación falta:</b>
                        <ul className="grid gap-1.5">
                          {missing.map((check) => (
                            <li key={check.id}>
                              <b className="font-semibold text-fg">{check.label}</b> ({check.detail}). {CLOSE_REMEDY[check.id]}
                            </li>
                          ))}
                        </ul>
                      </InfoTip>
                    </span>
                  )
                : undefined
            }
          >
            <input type="hidden" name="status" value={transition.status} />
            <ConfirmNote tone={blocked ? "warn" : "neutral"}>{blocked ? "Todavía no se cumplen todas las condiciones de cierre. Resuelve lo que está en rojo y vuelve a intentarlo." : NEXT_NOTE[transition.status]}</ConfirmNote>
            {closing && <CloseChecklist checks={checks} detailed />}
          </OpsStep>
        );
      })}
    </>
  );
}

type Picked = { guide_id: string; driver_id: string; vehicle_id: string };

function PreviewList({ preview, checking }: { preview: AssignmentPreview | null; checking: boolean }) {
  if (checking && !preview) return <ConfirmNote>Revisando disponibilidad…</ConfirmNote>;
  if (!preview) return <ConfirmNote>Elige al menos un recurso para revisar cruces de horario, capacidad y vigencia de licencias y SOAT.</ConfirmNote>;
  const clean = preview.ready && preview.warnings.length === 0;
  return (
    <ul className={cn("flex flex-col gap-1.5 transition-opacity", checking && "opacity-60")} aria-live="polite">
      {preview.blocks.map((text) => (
        <li key={text} className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-3 py-2 text-[12.5px] text-fg">
          <Ban size={14} className="mt-0.5 flex-none text-bad" />
          {text}
        </li>
      ))}
      {preview.warnings.map((text) => (
        <li key={text} className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3 py-2 text-[12.5px] text-fg">
          <TriangleAlert size={14} className="mt-0.5 flex-none text-warn" />
          {text}
        </li>
      ))}
      {clean && (
        <li className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3 py-2 text-[12.5px] text-fg">
          <Check size={14} className="flex-none text-ok" />
          Sin cruces de horario, con capacidad suficiente y documentos vigentes.
        </li>
      )}
    </ul>
  );
}

export function AssignAction({ assignment, options, trigger }: { assignment: Assignment; options: ResourceOptions; trigger: (open: () => void) => ReactNode }) {
  const [ack, setAck] = useState(false);
  const [push, setPush] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [picked, setPicked] = useState<Picked>({ guide_id: assignment.guide?.id ?? "", driver_id: assignment.driver?.id ?? "", vehicle_id: assignment.vehicle?.id ?? "" });
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [checking, start] = useTransition();
  const none = [{ value: "", label: "Sin asignar" }];
  const check = (next: Picked) =>
    start(async () => {
      setPreview(next.guide_id || next.driver_id || next.vehicle_id ? await previewAssignment(assignment.id, next) : null);
    });
  const pick = (key: keyof Picked) => (value: string) => {
    const next = { ...picked, [key]: value };
    setPicked(next);
    check(next);
  };
  const notifying = push || whatsapp;
  const recipients = preview?.context.recipients ?? 0;
  return (
    <OpsStep
      step="assign"
      target={assignment.id}
      version={assignment.lock_version}
      label={assignment.status === "pendiente" ? "Asignar" : "Reasignar"}
      icon={<Truck size={16} />}
      size="sm"
      title={assignment.status === "pendiente" ? "Asignar recursos" : "Reasignar recursos"}
      description={`${assignment.label} · ${formatDate(assignment.date)}${assignment.time ? ` ${assignment.time}` : ""} · ${assignment.passengers} pax`}
      submitLabel="Guardar asignación"
      trigger={(open) =>
        trigger(() => {
          open();
          setTimeout(() => check(picked), 0);
        })
      }
    >
      {preview && (
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <span className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Pasajeros</span>
            <b className="text-[13px]">{preview.context.passengers}</b>
          </span>
          <span className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Idiomas del grupo</span>
            <b className="block truncate text-[13px]">{preview.context.languages.length ? preview.context.languages.join(", ") : "Español"}</b>
          </span>
          <span className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Proveedor</span>
            <b className="block truncate text-[13px]">{preview.context.provider ?? "Propio"}</b>
          </span>
        </div>
      )}
      <SelectField label="Guía" name="guide_id" options={[...none, ...options.guides]} defaultValue={picked.guide_id} onChange={pick("guide_id")} searchable />
      <SelectField label="Conductor" name="driver_id" options={[...none, ...options.drivers]} defaultValue={picked.driver_id} onChange={pick("driver_id")} searchable />
      <SelectField label="Vehículo" name="vehicle_id" options={[...none, ...options.vehicles]} defaultValue={picked.vehicle_id} onChange={pick("vehicle_id")} searchable />
      <PreviewList preview={preview} checking={checking} />
      {preview && preview.warnings.length > 0 && preview.blocks.length === 0 && <SwitchField label="Asumo las advertencias" hint="Quedan registradas con tu nombre en la asignación." name="ack_warnings" checked={ack} onCheckedChange={setAck} />}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-fg">Avisar al equipo</legend>
        <SwitchField label="Push a la app del operador" name="notify_push" checked={push} onCheckedChange={setPush} />
        <SwitchField label="WhatsApp" name="notify_whatsapp" checked={whatsapp} onCheckedChange={setWhatsapp} />
        {push && <input type="hidden" name="notify" value="push" />}
        {whatsapp && <input type="hidden" name="notify" value="whatsapp" />}
        {notifying && (
          <ConfirmNote tone={recipients ? "neutral" : "warn"}>
            {recipients
              ? `Push y WhatsApp aún no están conectados a un proveedor de envío: el aviso queda en la bandeja interna de ${recipients === 1 ? "la persona asignada" : `las ${recipients} personas asignadas`}.`
              : "El guía o conductor elegido no tiene usuario vinculado: no recibirá el aviso."}
          </ConfirmNote>
        )}
      </fieldset>
    </OpsStep>
  );
}

export function CheckinAction({ assignment, passengers, today }: { assignment: Assignment; passengers: OrderDetail["passengers"]; today: string }) {
  if (assignment.status === "pendiente") return null;
  const checked = assignment.checked_in ?? [];
  if (!["en_curso", "completada"].includes(assignment.status)) return <RowIcon tone="neutral" label="Check-in de pasajeros" icon={<ClipboardCheck size={15} />} disabledHint="El check-in se registra cuando el servicio inicia" />;
  if (assignment.date > today) return <RowIcon tone="neutral" label="Check-in de pasajeros" icon={<ClipboardCheck size={15} />} disabledHint={`El check-in se registra desde el ${formatDate(assignment.date)}`} />;
  return (
    <OpsStep
      step="assign_checkins"
      target={assignment.id}
      formKey={`${assignment.id}-checkin`}
      label="Check-in de pasajeros"
      title="Check-in de pasajeros"
      description={`${assignment.label} · ${formatDate(assignment.date)} · ${checked.length} de ${passengers.length} presentes`}
      submitLabel="Guardar check-in"
      trigger={(open) => <RowIcon tone="view" label="Check-in de pasajeros" icon={<ClipboardCheck size={15} />} onClick={open} />}
    >
      <ConfirmNote>Marca a quienes se presentaron. Quien quede sin marcar figura como no presentado al cerrar el servicio.</ConfirmNote>
      <ToggleChips label="Pasajeros presentes" name="passenger_ids" defaultValue={checked} options={passengers.map((passenger) => ({ value: passenger.id, label: passenger.full_name, hint: passenger.pax_type }))} />
    </OpsStep>
  );
}

export function AssignmentControls({ assignment, options, passengers, today }: { assignment: Assignment; options: ResourceOptions; passengers: OrderDetail["passengers"]; today: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <CheckinAction assignment={assignment} passengers={passengers} today={today} />
      <AssignAction assignment={assignment} options={options} trigger={(open) => <RowIcon tone="edit" label={assignment.status === "pendiente" ? "Asignar recursos" : "Reasignar"} icon={<Truck size={15} />} onClick={open} />} />
      <AssignmentQuickActions assignment={assignment} />
    </span>
  );
}

export function AssignmentQuickActions({ assignment }: { assignment: Assignment }) {
  const { run, pending, error } = useQuickStep();
  return (
    <span className="flex flex-col items-end">
      <span className="flex gap-1.5">
        {assignment.status === "asignada" && <RowIcon tone="neutral" label="Registrar confirmación del recurso" icon={<UserCheck size={15} />} onClick={() => run({ step: "assign_confirm", target: assignment.id, lock_version: String(assignment.lock_version) })} disabledHint={pending ? "Un momento…" : undefined} />}
        {["asignada", "confirmada"].includes(assignment.status) && <RowIcon tone="delete" label="Liberar recursos" icon={<UserMinus size={15} />} onClick={() => run({ step: "assign_release", target: assignment.id, lock_version: String(assignment.lock_version) })} disabledHint={pending ? "Un momento…" : undefined} />}
      </span>
      <QuickError message={error} />
    </span>
  );
}

export function TaskList({ code, tasks, editable }: { code: string; tasks: OrderDetail["tasks"]; editable: boolean }) {
  const { run, pending, error } = useQuickStep();
  return (
    <>
      <ul className="flex flex-col gap-1">
        {tasks.map((task, index) => (
          <li key={task.id} className="group flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2" style={{ animationDelay: `${index * 50}ms` }}>
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              disabled={!editable || pending}
              onClick={() => run({ step: "task_toggle", target: task.id, done: task.done ? "0" : "1" })}
              className={cn("grid h-6 w-6 flex-none place-items-center rounded-lg border-2 transition duration-200", task.done ? "border-ok bg-ok text-white" : "border-line bg-surface", editable && "hover:scale-110 hover:border-ok")}
            >
              {task.done && <Check size={14} strokeWidth={3} />}
            </button>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[13.5px]", task.done && "text-fg-3 line-through")}>{task.title}</span>
              {task.done && task.done_by && <span className="text-xs text-fg-3">{task.done_by}{task.done_at ? ` · ${formatDateTime(task.done_at, false)}` : ""}</span>}
            </span>
            {editable && (
              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                <RowIcon tone="delete" label="Eliminar tarea" icon={<Trash2 size={14} />} onClick={() => run({ step: "task_delete", target: task.id })} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <QuickError message={error} />
      {editable && (
        <OpsStep step="task_add" target={code} formKey={`${code}-task`} label="Agregar tarea" icon={<Plus size={15} />} title="Agregar tarea" submitLabel="Agregar" trigger={(open) => <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={open} className="mt-2">Agregar tarea</Button>}>
          <TextField label="Tarea" name="title" required minLength={3} maxLength={250} placeholder="Confirmar silla de bebé para el traslado" />
        </OpsStep>
      )}
    </>
  );
}
