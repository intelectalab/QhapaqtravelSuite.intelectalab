"use client";

import { ArrowRightLeft, Hand, RotateCcw, Target, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeLeadStatus, convertLead, qualifyLead, reopenLead, takeLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { TIME_ZONE } from "@/lib/format";
import { BANT_LEVELS, type Advisor, type CrmCatalogs, type LeadDetail } from "@/lib/leads";
import type { OpportunityFormOptions } from "@/lib/opportunities";
import { LeadAssignAction, LeadDiscardAction, LeadEditAction } from "./LeadEditActions";
import { FormSection } from "./LeadFields";

const initial: LeadActionState = { message: null, done: false };

const BANT = [
  { name: "budget", label: "Presupuesto", hint: "¿Tiene el dinero para el viaje?" },
  { name: "authority", label: "Decisión", hint: "¿Es quien decide o paga?" },
  { name: "need", label: "Necesidad", hint: "¿Sabe qué quiere?" },
  { name: "timeline", label: "Plazo", hint: "¿Tiene fecha para viajar?" },
] as const;

const STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "calificado", label: "Calificado" },
];

function Hidden({ lead }: { lead: LeadDetail }) {
  return (
    <>
      <input type="hidden" name="code" value={lead.code} />
      <input type="hidden" name="lock_version" value={lead.lock_version} />
    </>
  );
}

function BantForm({ lead }: { lead: LeadDetail }) {
  const [values, setValues] = useState<Record<string, number>>({
    budget: lead.bant?.budget ?? 0,
    authority: lead.bant?.authority ?? 0,
    need: lead.bant?.need ?? 0,
    timeline: lead.bant?.timeline ?? 0,
  });
  const [markWanted, setMarkWanted] = useState(true);
  const score = Object.values(values).reduce((total, value) => total + value, 0);
  const enough = score >= 50;

  return (
    <>
      <Hidden lead={lead} />
      <div className={cn("flex items-center gap-4 rounded-xl p-4", enough ? "bg-ok/10" : "bg-surface-2")}>
        <span className={cn("text-[34px] font-bold tracking-tight", enough ? "text-ok" : "text-fg")}>{score}</span>
        <span className="text-[13px] text-fg-2">
          <b className="block text-fg">Puntaje BANT de 100</b>
          {enough ? "Alcanza para calificarlo." : "Necesita 50 o más para calificarlo."}
        </span>
      </div>
      {BANT.map((criterion) => (
        <ChoiceGroup
          key={criterion.name}
          label={criterion.label}
          hint={criterion.hint}
          name={criterion.name}
          options={BANT_LEVELS}
          defaultValue={String(values[criterion.name])}
          onChange={(value) => setValues((current) => ({ ...current, [criterion.name]: Number(value) }))}
        />
      ))}
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <TextField label="Monto que piensa invertir (opcional)" name="amount" type="number" min={0} step="0.01" defaultValue={lead.bant?.declared_amount ?? ""} />
        <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={lead.bant?.currency ?? "PEN"} />
      </div>
      <TextArea label="Notas" name="notes" rows={2} defaultValue={lead.bant?.notes ?? ""} />
      <SwitchField
        label="Marcar el lead como calificado"
        hint={enough ? "Queda listo para convertirlo en cliente." : "Se activa cuando el puntaje llega a 50."}
        name="mark_qualified"
        checked={enough && markWanted}
        onCheckedChange={setMarkWanted}
        disabled={!enough}
      />
    </>
  );
}

const DOCUMENTS = [
  { value: "DNI", label: "DNI" },
  { value: "RUC", label: "RUC" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "CE", label: "Carné de extranjería" },
];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

function ConvertForm({ lead, catalogs, options, canReassign }: { lead: LeadDetail; catalogs: CrmCatalogs; options: OpportunityFormOptions | null; canReassign: boolean }) {
  const [mode, setMode] = useState<string>("new");
  const [kind, setKind] = useState<string>(lead.company ? "empresa" : "persona");
  const [discovery, setDiscovery] = useState(true);
  const company = kind === "empresa";
  const clients = options?.clients ?? [];
  const segments = catalogs.client_segment.map((item) => ({ value: item.label, label: item.label }));
  const suggested = /corporativ/i.test(lead.interest) ? "Corporativo" : /promoci/i.test(lead.interest) || lead.pax >= 10 ? "Grupos" : "Retail";
  const segment = segments.some((item) => item.value === suggested) ? suggested : segments[0]?.value;
  const defaultTitle = `${lead.name.split(" ").slice(0, 2).join(" ")} — ${lead.destination ?? lead.interest}`;

  return (
    <>
      <Hidden lead={lead} />
      <FormSection title="Cliente">
        {clients.length > 0 && (
          <ChoiceGroup
            label="¿Ya es cliente?"
            name="client_mode"
            defaultValue={mode}
            onChange={setMode}
            options={[
              { value: "new", label: "Crear cliente nuevo" },
              { value: "existing", label: "Vincular a uno existente" },
            ]}
          />
        )}
        {mode === "existing" ? (
          <SelectField label="Cliente" name="client_code" options={clients.map((client) => ({ value: client.code, label: client.name, hint: client.code }))} placeholder="Buscar cliente" searchable />
        ) : (
          <>
            <ChoiceGroup
              label="Tipo"
              name="kind"
              defaultValue={kind}
              onChange={setKind}
              options={[
                { value: "persona", label: "Persona" },
                { value: "empresa", label: "Empresa" },
              ]}
            />
            <TextField label={company ? "Razón social" : "Nombre completo"} name="client_name" required defaultValue={company ? lead.company ?? lead.name : lead.name} />
            <div className="grid grid-cols-[150px_1fr] gap-3">
              <SelectField key={kind} label="Documento" name="doc_type" options={DOCUMENTS} defaultValue={company ? "RUC" : "DNI"} />
              <TextField label="Número" name="doc_number" required autoComplete="off" />
            </div>
            <SelectField key="segment" label="Segmento" name="segment" options={segments} defaultValue={segment} hint="Sugerido por el interés y la cantidad de pasajeros del lead." />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Ciudad" name="city" />
              <TextField label="País" name="country" defaultValue="Perú" />
            </div>
          </>
        )}
      </FormSection>
      <FormSection title="Oportunidad">
        <TextField label="Nombre" name="opportunity_title" required defaultValue={defaultTitle} />
        {options && options.stages.length > 0 && <SelectField label="Etapa inicial" name="stage" options={options.stages.filter((stage) => stage.code === "calificacion" || stage.code === "descubrimiento").map((stage) => ({ value: stage.code, label: stage.name, hint: `${stage.probability} %` }))} defaultValue="descubrimiento" />}
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <TextField label="Monto estimado" name="amount" type="number" min={0} step="0.01" required defaultValue={lead.bant?.declared_amount ?? ""} />
          <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={lead.bant?.currency ?? "PEN"} />
        </div>
        <TextField label="Cierre esperado" name="expected_close_date" type="date" min={today()} required />
        {canReassign && options && options.advisors.length > 0 && (
          <SelectField label="Responsable" name="owner_id" options={options.advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))} defaultValue={lead.owner_id ?? ""} placeholder="El del lead" />
        )}
        <SwitchField label="Programar la reunión de descubrimiento" hint="Agenda una reunión para el siguiente día hábil a las 10:00." name="schedule_discovery_meeting" checked={discovery} onCheckedChange={setDiscovery} />
      </FormSection>
    </>
  );
}

export function LeadActions({ lead, catalogs, viewerId, advisors, opportunityOptions, editOpen = false }: { lead: LeadDetail; catalogs: CrmCatalogs; viewerId: string; advisors: Advisor[]; opportunityOptions: OpportunityFormOptions | null; editOpen?: boolean }) {
  const router = useRouter();
  const canManage = useCan("crm.leads.manage");
  const canConvert = useCan("crm.opportunities.manage");
  const canReassign = useCan("crm.records.reassign");
  const [taking, startTaking] = useTransition();
  const [takeError, setTakeError] = useState<string | null>(null);
  const open = ["nuevo", "contactado", "calificado"].includes(lead.status);
  const mine = lead.owner_id === null || lead.owner_id === viewerId || canReassign;

  if (!canManage || !mine) return null;

  if (lead.status === "descartado" || lead.status === "duplicado") {
    return (
      <PanelAction
        label="Reabrir"
        icon={<RotateCcw size={16} />}
        variant="primary"
        title="Reabrir lead"
        description={lead.status === "duplicado" ? "Vuelve a la cola como nuevo y deja de figurar como duplicado. Si fue fusionado, sus actividades se quedan en el lead que lo absorbió." : "Vuelve a la cola como nuevo para retomar la atención."}
        submitLabel="Reabrir"
        action={reopenLead}
        initial={initial}
      >
        {() => (
          <>
            <Hidden lead={lead} />
            <p className="text-[13.5px] text-fg-2">
              <b className="text-fg">{lead.name}</b> queda en estado Nuevo. El cambio queda en el historial.
            </p>
          </>
        )}
      </PanelAction>
    );
  }

  if (!open) return null;

  if (lead.owner_id === null) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap justify-end gap-2">
        {canReassign && <LeadAssignAction lead={lead} advisors={advisors} />}
        <LeadEditAction lead={lead} catalogs={catalogs} advisors={advisors} defaultOpen={editOpen} />
        <Button
          variant="primary"
          icon={<Hand size={16} />}
          disabled={taking}
          onClick={() =>
            startTaking(async () => {
              const result = await takeLead(lead.code);
              setTakeError(result.done ? null : result.message);
              if (result.done) router.refresh();
            })
          }
        >
          {taking ? "Un momento…" : "Tomar lead"}
        </Button>
        </div>
        {takeError && <FormError message={takeError} />}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <LeadEditAction lead={lead} catalogs={catalogs} advisors={advisors} defaultOpen={editOpen} />
      {canReassign && <LeadAssignAction lead={lead} advisors={advisors} />}
      <PanelAction label="Estado" icon={<ArrowRightLeft size={16} />} title="Cambiar estado" description="Para convertirlo o descartarlo usa sus propias acciones." submitLabel="Guardar" action={changeLeadStatus} initial={initial}>
        {() => (
          <>
            <Hidden lead={lead} />
            <ChoiceGroup label="Nuevo estado" name="status" options={STATUS_OPTIONS} defaultValue={lead.status} />
            <TextArea label="Comentario (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: respondió por WhatsApp y pidió fechas." />
          </>
        )}
      </PanelAction>
      <PanelAction label="Calificar" icon={<Target size={16} />} title="Calificar (BANT)" description="Cuatro preguntas para saber qué tan listo está para comprar." submitLabel="Guardar calificación" action={qualifyLead} initial={initial}>
        {() => <BantForm lead={lead} />}
      </PanelAction>
      <LeadDiscardAction lead={lead} catalogs={catalogs} />
      {lead.status === "calificado" && canConvert && (
        <PanelAction
          label="Convertir"
          icon={<Wand2 size={16} />}
          variant="primary"
          title="Convertir en cliente"
          description="Creamos o vinculamos el cliente y abrimos su oportunidad de venta en un solo paso. El lead queda como historial."
          submitLabel="Convertir"
          action={convertLead}
          initial={initial}
          onDone={(state) => state.result?.client && router.push(`/crm/clientes/${state.result.client}`)}
        >
          {() => <ConvertForm lead={lead} catalogs={catalogs} options={opportunityOptions} canReassign={canReassign} />}
        </PanelAction>
      )}
    </div>
  );
}
