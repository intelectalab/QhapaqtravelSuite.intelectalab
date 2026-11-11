"use client";

import { CalendarClock, CalendarPlus, Check, Pencil, Plus, Trash2, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { completeActivity, createActivity, deleteActivity, reassignActivity, rescheduleActivity, updateActivity, type ActivityState } from "@/app/(backoffice)/crm/actividades/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ACTIVITY_TYPES, RELATION_LABEL, RELATION_TYPES, type ActivityItem, type RelatedOptions } from "@/lib/activities";

const initial: ActivityState = { message: null, done: false };

const typeOptions = Object.entries(ACTIVITY_TYPES).map(([value, type]) => ({ value, label: type.label }));

const localDateTime = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export interface ActivityPreset {
  type: string;
  code: string;
  name: string;
}

type ServerAction = (state: ActivityState, form: FormData) => Promise<ActivityState>;

function relatedChoices(options: RelatedOptions) {
  return RELATION_TYPES.flatMap((type) => (options[type] ?? []).map((item) => ({ value: `${type}:${item.code}`, label: item.name, hint: `${RELATION_LABEL[type]} · ${item.code}` })));
}

function ActivityFields({ options, activity, preset, relationNote }: { options: RelatedOptions; activity?: ActivityItem; preset?: ActivityPreset; relationNote?: string }) {
  const current = activity?.related ? `${activity.related.type}:${activity.related.code}` : "";
  const choices = relatedChoices(options);
  const related = current && !choices.some((choice) => choice.value === current) && activity?.related ? [{ value: current, label: activity.related.name, hint: `${RELATION_LABEL[activity.related.type]} · ${activity.related.code}` }, ...choices] : choices;

  return (
    <>
      <SelectField label="Tipo" name="type" options={typeOptions} defaultValue={activity?.type ?? "llamada"} />
      <TextField label="Asunto" name="subject" required maxLength={200} defaultValue={activity?.subject} placeholder="Por ejemplo: Llamar para confirmar fechas" />
      {preset ? (
        <>
          <input type="hidden" name="related" value={`${preset.type}:${preset.code}`} />
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">
            {RELATION_LABEL[preset.type]}: <b className="text-fg">{preset.name}</b> · {preset.code}
          </p>
        </>
      ) : relationNote ? (
        <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">{relationNote}</p>
      ) : (
        <SelectField label="Relacionada con (opcional)" name="related" options={related} defaultValue={current} placeholder="Buscar lead, oportunidad, cliente o cotización" searchable clearable />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Fecha y hora" name="due_at" type="datetime-local" required defaultValue={activity ? localDateTime(activity.due_at) : undefined} icon={<CalendarClock size={17} />} />
        {options.owners.length > 0 && <SelectField label="Responsable" name="owner_id" options={options.owners.map((owner) => ({ value: owner.id, label: owner.name }))} defaultValue={activity?.owner.id ?? ""} placeholder="Tú" />}
      </div>
      <TextArea label="Descripción o guion (opcional)" name="description" rows={3} maxLength={2000} defaultValue={activity?.description ?? undefined} />
    </>
  );
}

export function ActivityCreateAction({
  options,
  preset,
  action = createActivity,
  hidden,
  relationNote,
  label = "Nueva actividad",
  size = "md",
  variant = "primary",
}: {
  options: RelatedOptions;
  preset?: ActivityPreset;
  action?: ServerAction;
  hidden?: Record<string, string | number>;
  relationNote?: string;
  label?: string;
  size?: "md" | "sm";
  variant?: "primary" | "secondary";
}) {
  const formId = `activity-create-${preset?.code ?? hidden?.conversation ?? "agenda"}`;
  return (
    <PanelAction
      label={label}
      icon={preset || hidden ? <CalendarPlus size={size === "sm" ? 15 : 16} /> : <Plus size={16} strokeWidth={2.4} />}
      variant={variant}
      size={size}
      formId={formId}
      title="Nueva actividad"
      description="Agenda una llamada, reunión o tarea para no perder el seguimiento."
      submitLabel="Agendar"
      action={action}
      initial={initial}
    >
      {() => (
        <>
          {Object.entries(hidden ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <ActivityFields options={options} preset={preset} relationNote={relationNote} />
        </>
      )}
    </PanelAction>
  );
}

function NextFields() {
  const [scheduleNext, setScheduleNext] = useState(true);
  return (
    <>
      <SwitchField label="Agendar la siguiente actividad" hint="Mantiene el seguimiento sin que se enfríe." name="schedule_next" checked={scheduleNext} onCheckedChange={setScheduleNext} />
      {scheduleNext && (
        <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
          <SelectField label="Tipo" name="next_type" options={typeOptions} defaultValue="llamada" />
          <TextField label="Asunto" name="next_subject" placeholder="Qué sigue" />
          <TextField label="Fecha y hora" name="next_due_at" type="datetime-local" icon={<CalendarClock size={17} />} />
        </div>
      )}
    </>
  );
}

function Hidden({ activity }: { activity: ActivityItem }) {
  return (
    <>
      <input type="hidden" name="code" value={activity.code} />
      <input type="hidden" name="lock_version" value={activity.lock_version} />
    </>
  );
}

export function ActivityReassignAction({ activity, owners, size = "sm", variant = "ghost" }: { activity: ActivityItem; owners: RelatedOptions["owners"]; size?: "md" | "sm"; variant?: "secondary" | "ghost" }) {
  const canReassign = useCan("crm.records.reassign");
  const choices = owners.filter((owner) => owner.id !== activity.owner.id).map((owner) => ({ value: owner.id, label: owner.name }));
  if (!canReassign || choices.length === 0 || activity.status === "completada") return null;

  return (
    <PanelAction
      label="Reasignar"
      icon={<UserRoundCog size={15} />}
      variant={variant}
      size={size}
      formId={`reasignar-${activity.code}`}
      title="Reasignar actividad"
      description={`${activity.subject}. Hoy la tiene ${activity.owner.name}.`}
      submitLabel="Reasignar"
      action={reassignActivity}
      initial={initial}
    >
      {() => (
        <>
          <Hidden activity={activity} />
          <SelectField label="Nuevo responsable" name="owner_id" options={choices} placeholder="Elegir" searchable />
          <TextArea label="Nota (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: cubre las vacaciones de la asesora." />
        </>
      )}
    </PanelAction>
  );
}

export function ActivityRowActions({ activity, options }: { activity: ActivityItem; options: RelatedOptions | null }) {
  return (
    <div className="flex gap-1.5">
      {options && <ActivityReassignAction activity={activity} owners={options.owners} />}
      {options && (
        <PanelAction
          label="Editar"
          icon={<Pencil size={15} />}
          variant="ghost"
          size="sm"
          formId={`editar-${activity.code}`}
          title="Editar actividad"
          description={activity.code}
          submitLabel="Guardar cambios"
          action={updateActivity}
          initial={initial}
        >
          {() => (
            <>
              <Hidden activity={activity} />
              <ActivityFields options={options} activity={activity} />
            </>
          )}
        </PanelAction>
      )}
      <PanelAction
        label="Eliminar"
        icon={<Trash2 size={15} />}
        variant="ghost"
        size="sm"
        formId={`eliminar-${activity.code}`}
        title="Eliminar actividad"
        description={`${activity.subject}. Se borra de la agenda; queda registrado en la auditoría.`}
        submitLabel="Eliminar"
        action={deleteActivity}
        initial={initial}
      >
        {() => (
          <>
            <input type="hidden" name="code" value={activity.code} />
            <TextArea label="Motivo (opcional)" name="reason" rows={2} maxLength={300} placeholder="Por ejemplo: se agendó dos veces." />
          </>
        )}
      </PanelAction>
      <PanelAction
        label="Reprogramar"
        icon={<CalendarClock size={15} />}
        variant="ghost"
        size="sm"
        formId={`reprogramar-${activity.code}`}
        title="Reprogramar"
        description={activity.subject}
        submitLabel="Guardar"
        action={rescheduleActivity}
        initial={initial}
      >
        {() => (
          <>
            <Hidden activity={activity} />
            <TextField label="Nueva fecha y hora" name="due_at" type="datetime-local" required defaultValue={localDateTime(activity.due_at)} icon={<CalendarClock size={17} />} />
            <TextArea label="Motivo (opcional)" name="reason" rows={2} maxLength={300} placeholder="Por ejemplo: el cliente pidió llamarlo el viernes." />
          </>
        )}
      </PanelAction>
      <PanelAction
        label="Completar"
        icon={<Check size={15} strokeWidth={2.6} />}
        size="sm"
        formId={`completar-${activity.code}`}
        title="Completar actividad"
        description={activity.subject}
        submitLabel="Completar"
        action={completeActivity}
        initial={initial}
      >
        {() => (
          <>
            <input type="hidden" name="code" value={activity.code} />
            <TextArea label="¿Cómo te fue?" name="result" rows={3} required placeholder="Por ejemplo: le interesa, pide propuesta para dos personas." />
            <NextFields />
          </>
        )}
      </PanelAction>
    </div>
  );
}
