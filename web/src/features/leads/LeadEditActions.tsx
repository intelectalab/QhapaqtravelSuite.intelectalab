"use client";

import { CalendarDays, CircleSlash, Mail, Pencil, Phone, User, UserRoundCog, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignLead, discardLead, updateLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { Advisor, CrmCatalogs, LeadDetail } from "@/lib/leads";

const initial: LeadActionState = { message: null, done: false };

const options = (items: CrmCatalogs[keyof CrmCatalogs]) => items.map((item) => ({ value: item.code, label: item.label }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function LeadEditAction({ lead, catalogs, defaultOpen = false }: { lead: LeadDetail; catalogs: CrmCatalogs; defaultOpen?: boolean }) {
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
          <Section title="Persona">
            <TextField label="Nombre" name="name" required defaultValue={lead.name} icon={<User size={17} />} />
            <TextField label="Empresa (opcional)" name="company" defaultValue={lead.company ?? undefined} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Correo" name="email" type="email" defaultValue={lead.email ?? undefined} icon={<Mail size={17} />} />
              <TextField label="Teléfono" name="phone" inputMode="tel" defaultValue={lead.phone ?? undefined} icon={<Phone size={17} />} />
            </div>
          </Section>
          <Section title="Cómo llegó">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Fuente" name="source" options={options(catalogs.lead_source)} defaultValue={lead.codes.source} />
              <SelectField label="Canal" name="channel" options={options(catalogs.lead_channel)} defaultValue={lead.codes.channel} />
            </div>
          </Section>
          <Section title="Qué busca">
            <SelectField label="Interés" name="interest" options={options(catalogs.lead_interest)} defaultValue={lead.codes.interest} />
            <TextField label="Destino" name="destination" defaultValue={lead.destination ?? undefined} placeholder="Por ejemplo: Cusco" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Fecha de viaje" name="travel_date" type="date" defaultValue={lead.travel_date ?? undefined} icon={<CalendarDays size={17} />} />
              <TextField label="Pasajeros" name="pax" type="number" min={0} defaultValue={lead.pax || undefined} icon={<Users size={17} />} />
            </div>
            <TextArea label="Notas" name="notes" rows={3} defaultValue={lead.notes ?? undefined} />
          </Section>
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
          <SelectField label="Motivo" name="reason" options={options(catalogs.discard_reason)} placeholder="Elegir" />
          <TextArea label="Detalle (opcional)" name="detail" rows={3} />
        </>
      )}
    </PanelAction>
  );
}
