"use client";

import { CalendarDays, Mail, Phone, User, Users } from "lucide-react";
import { useCan } from "@/components/shell/SessionProvider";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TIME_ZONE } from "@/lib/format";
import { catalogOptions, destinationOptions, productOptions, type Advisor, type CrmCatalogs, type LeadDetail } from "@/lib/leads";

export interface LeadDefaults {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  channel?: string;
  source?: string;
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function LeadFields({ catalogs, advisors, lead, defaults, autoFocus = false }: { catalogs: CrmCatalogs; advisors: Advisor[]; lead?: LeadDetail; defaults?: LeadDefaults; autoFocus?: boolean }) {
  const canAssign = useCan("crm.records.reassign");
  const legacyDestination = lead && !lead.destination_id && lead.destination ? lead.destination : null;

  return (
    <>
      <FormSection title="Persona">
        <TextField label="Nombre" name="name" required autoFocus={autoFocus} defaultValue={lead?.name ?? defaults?.name ?? undefined} icon={<User size={17} />} />
        <TextField label="Empresa (opcional)" name="company" defaultValue={lead?.company ?? undefined} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Correo" name="email" type="email" defaultValue={lead?.email ?? defaults?.email ?? undefined} icon={<Mail size={17} />} />
          <TextField label="Teléfono" name="phone" inputMode="tel" defaultValue={lead?.phone ?? defaults?.phone ?? undefined} icon={<Phone size={17} />} />
        </div>
        <p className="-mt-1 text-[12.5px] text-fg-3">Basta con el correo o el teléfono.</p>
      </FormSection>
      <FormSection title="Cómo llegó">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Fuente" name="source" options={catalogOptions(catalogs.lead_source)} defaultValue={lead?.codes.source ?? defaults?.source} placeholder="Elegir" />
          <SelectField label="Canal" name="channel" options={catalogOptions(catalogs.lead_channel)} defaultValue={lead?.codes.channel ?? defaults?.channel} placeholder="Elegir" />
        </div>
      </FormSection>
      <FormSection title="Qué busca">
        <SelectField label="Interés" name="interest" options={catalogOptions(catalogs.lead_interest)} defaultValue={lead?.codes.interest} placeholder="Elegir" />
        <SelectField
          label="Destino"
          name="destination_id"
          options={destinationOptions(catalogs.destinations)}
          defaultValue={lead?.destination_id ?? ""}
          placeholder="Elegir del catálogo"
          searchable
          clearable
          hint={legacyDestination ? `Hoy dice «${legacyDestination}». Elige el destino del catálogo para reemplazarlo.` : undefined}
        />
        {legacyDestination && <input type="hidden" name="destination" value={legacyDestination} />}
        <SelectField label="Producto de interés (opcional)" name="product_id" options={productOptions(catalogs.products)} defaultValue={lead?.product?.id ?? ""} placeholder="Elegir un producto activo" searchable clearable />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha de viaje" name="travel_date" type="date" min={lead ? undefined : today()} defaultValue={lead?.travel_date ?? undefined} icon={<CalendarDays size={17} />} />
          <TextField label="Pasajeros" name="pax" type="number" min={0} defaultValue={lead?.pax || undefined} icon={<Users size={17} />} />
        </div>
      </FormSection>
      <FormSection title="Seguimiento">
        {canAssign && advisors.length > 0 ? (
          <SelectField label="Responsable" name="owner_id" options={advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))} defaultValue={lead?.owner_id ?? ""} placeholder="En la cola comercial" clearable={!lead?.owner_id} hint={lead?.owner_id ? "Al cambiarlo, sus actividades pendientes pasan al nuevo asesor." : undefined} />
        ) : (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">{lead?.owner ? `Lo atiende ${lead.owner.name}.` : "Queda en tu cartera."}</p>
        )}
        <TextArea label="Notas" name="notes" rows={3} defaultValue={lead?.notes ?? undefined} placeholder="Lo que contó en el primer mensaje." />
      </FormSection>
    </>
  );
}
