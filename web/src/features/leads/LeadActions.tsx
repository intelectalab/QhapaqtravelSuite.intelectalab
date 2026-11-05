"use client";

import { ArrowRightLeft, CircleSlash, Hand, Target, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeLeadStatus, convertLead, discardLead, qualifyLead, takeLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
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
import { BANT_LEVELS, type CrmCatalogs, type LeadDetail } from "@/lib/leads";

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

export function LeadActions({ lead, catalogs, viewerId }: { lead: LeadDetail; catalogs: CrmCatalogs; viewerId: string }) {
  const router = useRouter();
  const canManage = useCan("crm.leads.manage");
  const canConvert = useCan("crm.opportunities.manage");
  const canReassign = useCan("crm.records.reassign");
  const [taking, startTaking] = useTransition();
  const [takeError, setTakeError] = useState<string | null>(null);
  const open = ["nuevo", "contactado", "calificado"].includes(lead.status);
  const mine = lead.owner_id === null || lead.owner_id === viewerId || canReassign;

  if (!canManage || !open || !mine) return null;

  if (lead.owner_id === null) {
    return (
      <div className="flex flex-col items-end gap-1">
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
        {takeError && <FormError message={takeError} />}
      </div>
    );
  }

  const defaultTitle = `${lead.name.split(" ").slice(0, 2).join(" ")} — ${lead.destination ?? lead.interest}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <PanelAction label="Estado" icon={<ArrowRightLeft size={16} />} title="Cambiar estado" description="Para convertirlo o descartarlo usa sus propias acciones." submitLabel="Guardar" action={changeLeadStatus} initial={initial}>
        {() => (
          <>
            <Hidden lead={lead} />
            <ChoiceGroup label="Nuevo estado" name="status" options={STATUS_OPTIONS} defaultValue={lead.status} />
          </>
        )}
      </PanelAction>
      <PanelAction label="Calificar" icon={<Target size={16} />} title="Calificar (BANT)" description="Cuatro preguntas para saber qué tan listo está para comprar." submitLabel="Guardar calificación" action={qualifyLead} initial={initial}>
        {() => <BantForm lead={lead} />}
      </PanelAction>
      <PanelAction label="Descartar" icon={<CircleSlash size={16} />} variant="ghost" title="Descartar lead" description="El lead no se borra: queda en el historial con su motivo." submitLabel="Descartar" action={discardLead} initial={initial}>
        {() => (
          <>
            <Hidden lead={lead} />
            <SelectField label="Motivo" name="reason" options={catalogs.discard_reason.map((item) => ({ value: item.code, label: item.label }))} placeholder="Elegir" />
            <TextArea label="Detalle (opcional)" name="detail" rows={3} />
          </>
        )}
      </PanelAction>
      {lead.status === "calificado" && canConvert && (
        <PanelAction
          label="Convertir"
          icon={<Wand2 size={16} />}
          variant="primary"
          title="Convertir en cliente"
          description="Creamos el cliente y su oportunidad de venta en un solo paso. El lead queda como historial."
          submitLabel="Convertir"
          action={convertLead}
          initial={initial}
          onDone={(state) => state.result?.client && router.push(`/crm/clientes/${state.result.client}`)}
        >
          {() => (
            <>
              <Hidden lead={lead} />
              <h3 className="text-[13.5px] font-semibold text-fg border-b border-line-2 pb-1.5">Cliente</h3>
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <SelectField
                  label="Documento"
                  name="doc_type"
                  options={[
                    { value: "DNI", label: "DNI" },
                    { value: "RUC", label: "RUC" },
                    { value: "PASAPORTE", label: "Pasaporte" },
                    { value: "CE", label: "Carné de extranjería" },
                  ]}
                  defaultValue={lead.company ? "RUC" : "DNI"}
                />
                <TextField label="Número" name="doc_number" required />
              </div>
              <TextField label="Ciudad" name="city" />
              <h3 className="mt-2 text-[13.5px] font-semibold text-fg border-b border-line-2 pb-1.5">Oportunidad</h3>
              <TextField label="Nombre" name="opportunity_title" required defaultValue={defaultTitle} />
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <TextField label="Monto estimado" name="amount" type="number" min={0} step="0.01" required defaultValue={lead.bant?.declared_amount ?? ""} />
                <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={lead.bant?.currency ?? "PEN"} />
              </div>
              <TextField label="Cierre esperado" name="expected_close_date" type="date" required />
            </>
          )}
        </PanelAction>
      )}
    </div>
  );
}
