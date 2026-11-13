"use client";

import { Archive, ArrowRightCircle, CheckCircle2, ClipboardPen, MessageSquarePlus, Plus, Star } from "lucide-react";
import { useState } from "react";
import { moveCase, saveCase, saveSurvey } from "@/app/(backoffice)/crm/postventa/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { AfterSalesOverview, CaseItem, SurveyItem, TripItem } from "@/lib/aftersales";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export function ScorePicker({ name, defaultValue }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">¿Qué tan probable es que nos recomiende?</legend>
      <div role="radiogroup" className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, score) => {
          const tone = score >= 9 ? "bg-ok" : score >= 7 ? "bg-warn" : "bg-bad";
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              onClick={() => setValue(score)}
              className={cn("h-10 rounded-[9px] text-[13px] font-bold transition duration-200 hover:-translate-y-0.5", value === score ? `${tone} text-white shadow-[0_8px_16px_-10px_currentColor]` : "bg-surface-2 text-fg-2 hover:bg-surface hover:shadow-card")}
            >
              {score}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 flex justify-between text-[11.5px] text-fg-3">
        <span>Nada probable</span>
        <span>Muy probable</span>
      </p>
      {value !== null && <input type="hidden" name={name} value={value} />}
    </fieldset>
  );
}

function ClientReservationFields({ overview, hint }: { overview: AfterSalesOverview; hint?: string }) {
  const [client, setClient] = useState("");
  const [reservation, setReservation] = useState("");
  const options = (overview.reservations ?? []).filter((item) => item.client === client).map(({ value, label, hint: date }) => ({ value, label, hint: date }));
  return (
    <>
      <SelectField
        label="Cliente"
        name="client"
        options={overview.clients}
        placeholder="Buscar cliente"
        searchable
        value={client}
        onChange={(next) => {
          setClient(next);
          setReservation("");
        }}
      />
      <SelectField label="Reserva (opcional)" name="reservation" options={options} value={reservation} onChange={setReservation} placeholder={client ? (options.length > 0 ? "Elegir una reserva del cliente" : "El cliente no tiene reservas") : "Primero elige el cliente"} disabled={!client || options.length === 0} searchable clearable hint={hint} />
    </>
  );
}

export function SurveyAction({ overview, trip, survey }: { overview: AfterSalesOverview; trip?: TripItem; survey?: SurveyItem }) {
  const editing = Boolean(survey);
  return (
    <PanelAction<StepResult>
      label={trip ? "Encuestar" : "Registrar encuesta"}
      icon={trip ? <Star size={15} /> : <MessageSquarePlus size={16} />}
      variant={trip ? "secondary" : "primary"}
      size={trip ? "sm" : "md"}
      formId={survey ? `encuesta-${survey.code}` : trip ? `encuesta-${trip.code}` : "nueva-encuesta"}
      title={editing ? "Editar encuesta" : "Registrar encuesta NPS"}
      description={survey ? `${survey.client.name} · ${survey.code}` : trip ? `${trip.client.name} · ${trip.title}` : "Un puntaje de 6 o menos abre un caso de seguimiento automáticamente."}
      submitLabel={editing ? "Guardar" : "Registrar"}
      action={saveSurvey}
      initial={initial}
      trigger={survey ? (open) => <RowIcon tone="edit" label="Editar encuesta" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {survey && <input type="hidden" name="code" value={survey.code} />}
          {trip && (
            <>
              <input type="hidden" name="client" value={trip.client.code} />
              <input type="hidden" name="reservation" value={trip.code} />
            </>
          )}
          {!survey && !trip && <ClientReservationFields overview={overview} hint="Una sola encuesta por reserva." />}
          <ScorePicker name="score" defaultValue={survey?.score} />
          <SelectField label="Canal" name="channel" options={overview.channels} defaultValue={survey?.channel_code ?? "llamada"} />
          <TextArea label="Comentario del cliente" name="comment" rows={3} maxLength={2000} defaultValue={survey?.comment ?? undefined} placeholder="Lo que destacó o lo que podemos mejorar." />
        </>
      )}
    </PanelAction>
  );
}

export function CaseFormAction({ overview, item }: { overview: AfterSalesOverview; item?: CaseItem }) {
  return (
    <PanelAction<StepResult>
      label="Registrar caso"
      icon={<Plus size={16} strokeWidth={2.4} />}
      formId={item ? `caso-${item.code}` : "nuevo-caso"}
      title={item ? "Editar caso" : "Registrar caso de postventa"}
      description={item ? `${item.code} · ${item.client?.name ?? ""}` : "Reclamos, quejas, sugerencias o felicitaciones de un cliente."}
      submitLabel={item ? "Guardar cambios" : "Registrar"}
      action={saveCase}
      initial={initial}
      trigger={item ? (open) => <RowIcon tone="edit" label="Editar caso" onClick={open} disabledHint={item.status === "cerrada" ? "El caso está cerrado" : undefined} /> : undefined}
    >
      {() => (
        <>
          {item && <input type="hidden" name="code" value={item.code} />}
          {!item && <ClientReservationFields overview={overview} />}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tipo" name="type" options={overview.case_types} defaultValue={item?.type_code ?? "reclamo"} />
            <SelectField label="Prioridad" name="priority" options={PRIORITIES} defaultValue={item?.priority ?? "media"} />
          </div>
          <TextField label="Asunto" name="subject" required minLength={4} maxLength={200} defaultValue={item?.subject} icon={<ClipboardPen size={17} />} />
          <TextArea label="Descripción" name="description" rows={4} required minLength={5} maxLength={4000} defaultValue={item?.description} />
          {overview.owners.length > 0 && <SelectField label="Responsable" name="owner_id" options={overview.owners.map((owner) => ({ value: owner.id, label: owner.name }))} defaultValue={item?.owner.id ?? ""} placeholder="Yo" />}
        </>
      )}
    </PanelAction>
  );
}

const STEPS: Record<string, { step: string; label: string; icon: React.ReactNode; note: string | null; required: boolean }[]> = {
  abierta: [
    { step: "start", label: "Iniciar atención", icon: <ArrowRightCircle size={15} />, note: null, required: false },
    { step: "followup", label: "Registrar seguimiento", icon: <MessageSquarePlus size={15} />, note: "Nota de seguimiento", required: true },
    { step: "resolve", label: "Resolver", icon: <CheckCircle2 size={15} />, note: "¿Cómo se resolvió?", required: true },
  ],
  en_proceso: [
    { step: "followup", label: "Registrar seguimiento", icon: <MessageSquarePlus size={15} />, note: "Nota de seguimiento", required: true },
    { step: "resolve", label: "Resolver", icon: <CheckCircle2 size={15} />, note: "¿Cómo se resolvió?", required: true },
  ],
  resuelta: [{ step: "close", label: "Cerrar caso", icon: <Archive size={15} />, note: "Comentario de cierre (opcional)", required: false }],
};

export function CaseDetailAction({ item }: { item: CaseItem }) {
  const options = STEPS[item.status] ?? [];
  const [step, setStep] = useState(options[0]?.step ?? "");
  const current = options.find((option) => option.step === step);
  return (
    <PanelAction<StepResult>
      label="Ver caso"
      formId={`gestion-${item.code}`}
      title={item.subject}
      description={`${item.code} · ${item.type} · ${item.status_label}`}
      submitLabel={current?.label ?? "Listo"}
      action={current ? moveCase : async () => ({ message: null, done: true })}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Ver caso" onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={item.code} />
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="lock_version" value={item.lock_version} />
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{item.description}</p>
          {item.resolution && (
            <div className="rounded-xl border border-ok/30 bg-[color-mix(in_srgb,var(--ok)_8%,var(--surface))] px-3.5 py-2.5 text-[13px]">
              <p className="mb-0.5 font-semibold text-ok">Resolución</p>
              {item.resolution}
            </div>
          )}
          <ol className="flex flex-col gap-2 border-l-2 border-line pl-3.5">
            {item.log.map((entry) => (
              <li key={`${entry.at}-${entry.message}`} className="text-[12.5px]">
                <span className="font-semibold">{entry.message}</span>
                <span className="block text-fg-3">
                  {entry.by} · {formatDateTime(entry.at)}
                </span>
              </li>
            ))}
          </ol>
          {options.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
              <div className="flex flex-wrap gap-1.5">
                {options.map((option) => (
                  <Button key={option.step} type="button" size="sm" variant={option.step === step ? "primary" : "ghost"} icon={option.icon} onClick={() => setStep(option.step)}>
                    {option.label}
                  </Button>
                ))}
              </div>
              {current?.note && <TextArea key={current.step} label={current.note} name="note" rows={3} required={current.required} maxLength={2000} />}
            </div>
          )}
        </>
      )}
    </PanelAction>
  );
}
