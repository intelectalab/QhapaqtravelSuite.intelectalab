"use client";

import { CircleSlash, Pencil, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignLead, discardLead, updateLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { catalogOptions, type Advisor, type CrmCatalogs, type LeadDetail } from "@/lib/leads";
import { LeadFields } from "./LeadFields";

const initial: LeadActionState = { message: null, done: false };

export function LeadEditAction({ lead, catalogs, advisors, defaultOpen = false }: { lead: LeadDetail; catalogs: CrmCatalogs; advisors: Advisor[]; defaultOpen?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<LeadActionState>
      label="Editar"
      icon={<Pencil size={16} />}
      formId="lead-edit"
      defaultOpen={defaultOpen}
      title="Editar lead"
      description={`${lead.name} · ${lead.code}`}
      submitLabel="Guardar cambios"
      action={updateLead}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={lead.code} />
          <input type="hidden" name="lock_version" value={lead.lock_version} />
          <LeadFields catalogs={catalogs} advisors={advisors} lead={lead} />
        </>
      )}
    </PanelAction>
  );
}

export function LeadAssignAction({ lead, advisors }: { lead: LeadDetail; advisors: Advisor[] }) {
  const router = useRouter();
  const [firstContact, setFirstContact] = useState(lead.owner_id === null);
  const choices = advisors.filter((advisor) => advisor.id !== lead.owner_id);

  return (
    <PanelAction<LeadActionState>
      label={lead.owner_id ? "Reasignar" : "Asignar"}
      icon={<UserRoundCog size={16} />}
      formId="lead-assign"
      title={lead.owner_id ? "Reasignar lead" : "Asignar lead"}
      description={lead.owner ? `Hoy lo atiende ${lead.owner.name}. Sus actividades pendientes pasan al nuevo asesor.` : "Elige quién lo atenderá."}
      submitLabel={lead.owner_id ? "Reasignar" : "Asignar"}
      action={assignLead}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={lead.code} />
          <input type="hidden" name="lock_version" value={lead.lock_version} />
          <SelectField label="Asesor" name="owner_id" options={choices.map((advisor) => ({ value: advisor.id, label: advisor.name }))} placeholder="Elegir" />
          <SwitchField label="Programar el primer contacto en 2 horas" hint="Crea una llamada para el asesor elegido." name="schedule_first_contact" checked={firstContact} onCheckedChange={setFirstContact} />
          <TextArea label="Motivo (opcional)" name="reason" rows={2} maxLength={300} placeholder="Por ejemplo: habla inglés, o vacaciones del asesor." />
        </>
      )}
    </PanelAction>
  );
}

export function LeadDiscardAction({ lead, catalogs, iconOnly = false }: { lead: Pick<LeadDetail, "code" | "name" | "lock_version">; catalogs: CrmCatalogs; iconOnly?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<LeadActionState>
      label="Descartar"
      icon={<CircleSlash size={16} />}
      variant="ghost"
      formId={`lead-discard-${lead.code}`}
      title="Descartar lead"
      description={`${lead.name}. No se borra: queda en el historial con su motivo.`}
      submitLabel="Descartar"
      action={discardLead}
      initial={initial}
      trigger={iconOnly ? (open) => <RowIcon tone="delete" label="Descartar" onClick={open} /> : undefined}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={lead.code} />
          <input type="hidden" name="lock_version" value={lead.lock_version} />
          <SelectField label="Motivo" name="reason" options={catalogOptions(catalogs.discard_reason)} placeholder="Elegir" />
          <TextArea label="Detalle (opcional)" name="detail" rows={3} />
        </>
      )}
    </PanelAction>
  );
}
