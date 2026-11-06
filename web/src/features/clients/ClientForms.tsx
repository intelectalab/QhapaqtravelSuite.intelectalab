"use client";

import { Archive, AtSign, Building2, CalendarDays, MapPin, Pencil, Phone, Plus, Tag, TriangleAlert, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveClient, createClient, updateClient, type ClientActionState } from "@/app/(backoffice)/crm/clientes/actions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { DOC_TYPES, segmentLabel, type ClientDetail, type ClientFormOptions } from "@/lib/clients";

const initial: ClientActionState = { message: null, done: false };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function DuplicateNotice({ state }: { state: ClientActionState }) {
  if (!state.matches || state.matches.length === 0) return null;
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 text-[13px]">
      <p className="mb-2 flex items-center gap-2 font-semibold text-warn">
        <TriangleAlert size={16} />
        {state.softDuplicate ? "Se parece a otro cliente" : "Ese documento ya está registrado"}
      </p>
      <ul className="mb-2 flex flex-col gap-1 text-fg-2">
        {state.matches.map((match) => (
          <li key={match.code}>
            <b className="text-fg">{match.name}</b> · {match.code}
          </li>
        ))}
      </ul>
      <p className="text-fg-3">{state.softDuplicate ? "Si es otra persona con el mismo correo o teléfono, guárdalo igualmente." : "Abre ese cliente en lugar de crear otro."}</p>
    </div>
  );
}

function ClientFields({ options, client }: { options: ClientFormOptions; client?: ClientDetail }) {
  const [kind, setKind] = useState<string>(client?.rawKind ?? "persona");
  const company = kind === "empresa";

  return (
    <>
      <Section title="Quién es">
        <ChoiceGroup
          label="Tipo de cliente"
          name="kind"
          defaultValue={kind}
          onChange={setKind}
          options={[
            { value: "persona", label: "Persona" },
            { value: "empresa", label: "Empresa" },
          ]}
        />
        <TextField label={company ? "Razón social" : "Nombre completo"} name="name" required defaultValue={client?.name} icon={company ? <Building2 size={17} /> : <User size={17} />} />
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
          <SelectField key={kind} label="Documento" name="doc_type" options={DOC_TYPES} defaultValue={client && client.rawKind === kind ? client.docType : company ? "RUC" : "DNI"} />
          <TextField label="Número" name="doc_number" required defaultValue={client?.docNumber} inputMode="text" autoComplete="off" />
        </div>
        {!company && <TextField label="Fecha de nacimiento (opcional)" name="birth_date" type="date" defaultValue={client?.birth ?? undefined} icon={<CalendarDays size={17} />} />}
      </Section>
      <Section title="Contacto">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Correo" name="email" type="email" defaultValue={client?.email || undefined} icon={<AtSign size={17} />} />
          <TextField label="Teléfono" name="phone" inputMode="tel" defaultValue={client?.phone || undefined} icon={<Phone size={17} />} />
        </div>
        <p className="-mt-1 text-[12.5px] text-fg-3">Basta con el correo o el teléfono.</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ciudad" name="city" defaultValue={client?.city || undefined} icon={<MapPin size={17} />} />
          <TextField label="País" name="country" defaultValue={client?.country ?? "Perú"} />
        </div>
      </Section>
      <Section title="Para tu equipo">
        <SelectField key={client ? "segment" : kind} label="Segmento" name="segment" options={options.segments.map((segment) => ({ value: segment, label: segmentLabel(segment) }))} defaultValue={client?.rawSegment ?? (company ? "Corporativo" : options.segments[0])} />
        {options.canReassign && options.advisors.length > 0 && (
          <SelectField label="Responsable" name="owner_id" options={options.advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))} defaultValue={client?.ownerId} placeholder="Tú" />
        )}
        <TextField label="Etiquetas" name="tags" defaultValue={client?.tags.join(", ")} placeholder="Por ejemplo: Referido, Aventura" hint="Sepáralas con comas." icon={<Tag size={17} />} />
      </Section>
    </>
  );
}

const confirmButton = (formId: string) =>
  function ConfirmDuplicate(state: ClientActionState, pending: boolean) {
    return state.softDuplicate ? (
      <Button type="submit" form={formId} name="confirm_duplicate" value="1" variant="ghost" disabled={pending}>
        Guardar igualmente
      </Button>
    ) : null;
  };

export function ClientCreateAction({ options }: { options: ClientFormOptions }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Nuevo cliente"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="client-create"
      title="Nuevo cliente"
      description="Registra a una persona o empresa. Revisamos que el documento sea válido y que no exista ya."
      submitLabel="Registrar cliente"
      action={createClient}
      initial={initial}
      onDone={(state) => state.code && router.push(`/crm/clientes/${state.code}`)}
      footerExtra={confirmButton("client-create")}
    >
      {(state) => (
        <>
          <DuplicateNotice state={state} />
          <ClientFields options={options} />
        </>
      )}
    </PanelAction>
  );
}

export function ClientEditAction({ client, options, defaultOpen = false }: { client: ClientDetail; options: ClientFormOptions; defaultOpen?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Editar"
      icon={<Pencil size={16} />}
      formId="client-edit"
      defaultOpen={defaultOpen}
      title="Editar cliente"
      description={`${client.name} · ${client.id}`}
      submitLabel="Guardar cambios"
      action={updateClient}
      initial={initial}
      onDone={() => router.refresh()}
      footerExtra={confirmButton("client-edit")}
    >
      {(state) => (
        <>
          <input type="hidden" name="code" value={client.id} />
          <DuplicateNotice state={state} />
          <ClientFields options={options} client={client} />
        </>
      )}
    </PanelAction>
  );
}

export function ClientArchiveAction({ client, iconOnly = false }: { client: Pick<ClientDetail, "id" | "name">; iconOnly?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Archivar"
      icon={<Archive size={16} />}
      variant="ghost"
      formId={`client-archive-${client.id}`}
      title="Archivar cliente"
      description={`${client.name} dejará de aparecer en la lista y en los buscadores. Su historial de viajes, pagos y auditoría se conserva.`}
      submitLabel="Archivar cliente"
      action={archiveClient}
      initial={initial}
      trigger={iconOnly ? (open) => <RowIcon tone="delete" label="Archivar" onClick={open} /> : undefined}
      onDone={() => (iconOnly ? router.refresh() : router.push("/crm/clientes"))}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={client.id} />
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Solo se puede archivar si no tiene reservas en curso, oportunidades abiertas ni cobros pendientes.</p>
          <TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={300} placeholder="Por ejemplo: registro duplicado o dato de prueba." />
        </>
      )}
    </PanelAction>
  );
}
