"use client";

import { ArrowRight, Check, CircleCheckBig, Plus, Trash2, Truck, UserCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { opsStep } from "@/app/(backoffice)/operaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { Assignment, CloseCheck, OrderDetail, ResourceOptions } from "@/lib/operations";
import { ConfirmNote, OpsStep } from "./OpsStep";

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

export function AssignAction({ assignment, options, trigger }: { assignment: Assignment; options: ResourceOptions; trigger?: (open: () => void) => ReactNode }) {
  const [ack, setAck] = useState(false);
  const none = [{ value: "", label: "Sin asignar" }];
  return (
    <OpsStep
      step="assign"
      target={assignment.id}
      version={assignment.lock_version}
      label={assignment.status === "pendiente" ? "Asignar" : "Reasignar"}
      icon={<Truck size={16} />}
      size="sm"
      title={assignment.status === "pendiente" ? "Asignar recursos" : "Reasignar recursos"}
      description={`${assignment.label} · ${assignment.date}${assignment.time ? ` ${assignment.time}` : ""} · ${assignment.passengers} pax`}
      submitLabel="Guardar asignación"
      trigger={trigger}
    >
      <SelectField label="Guía" name="guide_id" options={[...none, ...options.guides]} defaultValue={assignment.guide?.id ?? ""} />
      <SelectField label="Conductor" name="driver_id" options={[...none, ...options.drivers]} defaultValue={assignment.driver?.id ?? ""} />
      <SelectField label="Vehículo" name="vehicle_id" options={[...none, ...options.vehicles]} defaultValue={assignment.vehicle?.id ?? ""} />
      <ConfirmNote>Se valida que cada recurso esté disponible, que no tenga otro servicio a menos de 6 horas, la capacidad del vehículo y la vigencia de licencias y SOAT.</ConfirmNote>
      <SwitchField label="Asumo las advertencias" hint="Necesario si la validación encuentra descansos, idiomas o documentos por vencer." name="ack_warnings" checked={ack} onCheckedChange={setAck} />
    </OpsStep>
  );
}

export function AssignmentControls({ assignment, options }: { assignment: Assignment; options: ResourceOptions }) {
  return (
    <span className="flex items-center gap-1.5">
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
