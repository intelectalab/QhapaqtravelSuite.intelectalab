"use client";

import { CalendarClock, Check, Plus } from "lucide-react";
import { useState } from "react";
import { completeActivity, createActivity, rescheduleActivity, type ActivityState } from "@/app/(backoffice)/crm/actividades/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ACTIVITY_TYPES, RELATION_LABEL, type ActivityItem, type RelatedOptions } from "@/lib/activities";

const initial: ActivityState = { message: null, done: false };

const typeOptions = Object.entries(ACTIVITY_TYPES).map(([value, type]) => ({ value, label: type.label }));

const localDateTime = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function ActivityCreateAction({ options }: { options: RelatedOptions }) {
  const related = (["lead", "opportunity", "client"] as const).flatMap((type) => options[type].map((item) => ({ value: `${type}:${item.code}`, label: item.name, hint: `${RELATION_LABEL[type]} · ${item.code}` })));

  return (
    <PanelAction label="Nueva actividad" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title="Nueva actividad" description="Agenda una llamada, reunión o tarea para no perder el seguimiento." submitLabel="Agendar" action={createActivity} initial={initial}>
      {() => (
        <>
          <SelectField label="Tipo" name="type" options={typeOptions} defaultValue="llamada" />
          <TextField label="Asunto" name="subject" required placeholder="Por ejemplo: Llamar para confirmar fechas" />
          <TextField label="Fecha y hora" name="due_at" type="datetime-local" required icon={<CalendarClock size={17} />} />
          <SelectField label="Relacionada con (opcional)" name="related" options={related} placeholder="Buscar lead, oportunidad o cliente" />
          <TextArea label="Detalle (opcional)" name="description" rows={3} />
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

export function ActivityRowActions({ activity }: { activity: ActivityItem }) {
  return (
    <div className="flex gap-1.5">
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
            <input type="hidden" name="code" value={activity.code} />
            <TextField label="Nueva fecha y hora" name="due_at" type="datetime-local" required defaultValue={localDateTime(activity.due_at)} icon={<CalendarClock size={17} />} />
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
