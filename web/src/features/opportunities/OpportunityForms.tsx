"use client";

import { CalendarDays, MapPin, Pencil, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createOpportunity, updateOpportunity, type OpportunityFormState } from "@/app/(backoffice)/crm/oportunidades/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TIME_ZONE } from "@/lib/format";
import type { OpportunityDetail, OpportunityFormOptions } from "@/lib/opportunities";

const initial: OpportunityFormState = { message: null, done: false };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function OpportunityFields({ options, opportunity, clientCode }: { options: OpportunityFormOptions; opportunity?: OpportunityDetail; clientCode?: string }) {
  const closed = opportunity ? ["ganada", "perdida"].includes(opportunity.stage) : false;

  return (
    <>
      <Section title="Qué se está vendiendo">
        <SelectField label="Cliente" name="client_code" options={options.clients.map((client) => ({ value: client.code, label: client.name, hint: client.code }))} defaultValue={opportunity?.client.code ?? clientCode ?? ""} placeholder="Elegir" searchable />
        <TextField label="Título" name="title" required maxLength={200} defaultValue={opportunity?.title} placeholder="Por ejemplo: Luna de miel en Cusco" />
        <SelectField label="Producto (opcional)" name="product_id" options={options.products.map((product) => ({ value: product.id, label: product.name, hint: product.code }))} defaultValue={opportunity?.product?.id ?? ""} placeholder="Elegir un producto activo" searchable clearable />
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3">
          <TextField label="Monto estimado" name="amount" type="number" min={1} step="0.01" required defaultValue={opportunity ? Number(opportunity.amount) : undefined} />
          <ChoiceGroup label="Moneda" name="currency" defaultValue={opportunity?.currency ?? "USD"} options={[{ value: "USD", label: "Dólares" }, { value: "PEN", label: "Soles" }]} />
        </div>
      </Section>
      <Section title="Cuándo y para quiénes">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Cierre esperado" name="expected_close_date" type="date" required min={opportunity ? undefined : today()} defaultValue={opportunity?.expected_close_date} icon={<CalendarDays size={17} />} />
          {opportunity ? (
            <TextField label="Probabilidad (%)" name="probability" type="number" min={0} max={100} required disabled={closed} defaultValue={opportunity.probability} hint={closed ? "Se fija al cerrar." : "Al cambiar de etapa vuelve a la de la etapa."} />
          ) : (
            <SelectField label="Etapa inicial" name="stage" options={options.stages.map((stage) => ({ value: stage.code, label: stage.name, hint: `${stage.probability} %` }))} defaultValue="descubrimiento" hint="Fija la probabilidad de la etapa." />
          )}
        </div>
        {closed && <input type="hidden" name="probability" value={opportunity?.probability} />}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Destino" name="destination" defaultValue={opportunity?.destination ?? undefined} placeholder="Cusco" icon={<MapPin size={17} />} />
          <TextField label="Pasajeros" name="pax" type="number" min={0} defaultValue={opportunity?.pax ?? undefined} icon={<Users size={17} />} />
        </div>
      </Section>
      <Section title="Seguimiento">
        {options.can_reassign && options.advisors.length > 0 && (
          <SelectField label="Responsable" name="owner_id" options={options.advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))} defaultValue={opportunity?.owner_id ?? ""} placeholder="Tú" />
        )}
        <TextArea label="Notas" name="notes" rows={3} maxLength={2000} defaultValue={opportunity?.notes ?? undefined} placeholder="Lo que pidió el cliente, presupuesto, fechas posibles." />
      </Section>
    </>
  );
}

export function OpportunityCreateAction({ options, clientCode, size = "md", variant = "primary", defaultOpen = false }: { options: OpportunityFormOptions; clientCode?: string; size?: "md" | "sm"; variant?: "primary" | "secondary"; defaultOpen?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<OpportunityFormState>
      label="Nueva oportunidad"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant={variant}
      size={size}
      formId="opportunity-create"
      title="Nueva oportunidad"
      description="Entra al embudo en la etapa que elijas, con su probabilidad por defecto."
      submitLabel="Crear oportunidad"
      action={createOpportunity}
      initial={initial}
      onDone={(state) => state.code && router.push(`/crm/oportunidades/${state.code}`)}
      defaultOpen={defaultOpen}
    >
      {() => <OpportunityFields options={options} clientCode={clientCode} />}
    </PanelAction>
  );
}

export function OpportunityEditAction({ opportunity, options }: { opportunity: OpportunityDetail; options: OpportunityFormOptions }) {
  const router = useRouter();
  return (
    <PanelAction<OpportunityFormState>
      label="Editar"
      icon={<Pencil size={16} />}
      formId="opportunity-edit"
      title="Editar oportunidad"
      description={`${opportunity.title} · ${opportunity.code}`}
      submitLabel="Guardar cambios"
      action={updateOpportunity}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={opportunity.code} />
          <input type="hidden" name="lock_version" value={opportunity.lock_version} />
          <OpportunityFields options={options} opportunity={opportunity} />
        </>
      )}
    </PanelAction>
  );
}
