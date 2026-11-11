"use client";

import { Archive, AtSign, Building2, CalendarDays, FileLock2, MapPin, Pencil, Phone, Plus, Tag, TriangleAlert, User, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { anonymizeClient, archiveClient, createClient, updateClient, type ClientActionState } from "@/app/(backoffice)/crm/clientes/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { RowIcon } from "@/components/table/RowActions";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { DOC_TYPES, segmentLabel, type ClientDetail, type ClientFormOptions } from "@/lib/clients";
import { formatDate } from "@/lib/format";

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
  const primary = client?.contacts.find((contact) => contact.is_primary);

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
      {company && (
        <Section title="Contacto principal">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
            <TextField label="Nombre" name="contact_name" defaultValue={primary?.name} icon={<UserRound size={17} />} />
            <TextField label="Cargo" name="contact_role" defaultValue={primary?.role ?? undefined} placeholder="Por ejemplo: Compras" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Correo" name="contact_email" type="email" defaultValue={primary?.email ?? undefined} icon={<AtSign size={17} />} />
            <TextField label="Teléfono" name="contact_phone" inputMode="tel" defaultValue={primary?.phone ?? undefined} icon={<Phone size={17} />} />
          </div>
          <p className="-mt-1 text-[12.5px] text-fg-3">{primary ? "Actualiza a la persona con quien coordinas. Los demás contactos están en «Contactos y datos»." : "La persona con quien coordinas los viajes de la empresa."}</p>
        </Section>
      )}
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

export function ClientAnonymizeAction({ client }: { client: Pick<ClientDetail, "id" | "name" | "arcoRequests"> }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <PanelAction<ClientActionState>
      label="Suprimir datos"
      icon={<FileLock2 size={16} />}
      variant="ghost"
      formId={`client-anonymize-${client.id}`}
      title="Suprimir datos personales"
      description={`Derecho de cancelación (Ley 29733). Se borran el nombre, el documento, el correo y el teléfono de ${client.name}, de sus contactos y de los pasajeros de sus reservas. Además se revocan sus autorizaciones y se cierra su acceso al portal.`}
      submitLabel="Suprimir datos"
      action={anonymizeClient}
      initial={initial}
      testId="client-anonymize"
      onDone={() => router.push("/crm/clientes")}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={client.id} />
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Se conservan las reservas, los pagos y los comprobantes que exige la ley, ya sin datos personales. Solo se puede hacer si el cliente no tiene viajes vigentes ni saldos por cobrar.</p>
          {client.arcoRequests.length > 0 && (
            <SelectField
              label="Solicitud que atiende"
              name="case"
              defaultValue={client.arcoRequests[0].code}
              options={client.arcoRequests.map((request) => ({ value: request.code, label: `${request.code} · ${request.subject.replace("Solicitud ARCO · ", "")}${request.dueDate ? ` · vence ${formatDate(request.dueDate)}` : ""}` }))}
              hint="Al suprimir, la solicitud queda resuelta."
            />
          )}
          <TextArea label="Motivo" name="reason" rows={3} minLength={10} maxLength={500} required placeholder="Por ejemplo: solicitud de cancelación del titular recibida por correo." />
          <SwitchField label="Entiendo que esto no se puede deshacer" name="confirm" checked={confirmed} onCheckedChange={setConfirmed} />
        </>
      )}
    </PanelAction>
  );
}

export function ClientDataRightsCard({ client, canErase }: { client: Pick<ClientDetail, "id" | "name" | "arcoRequests">; canErase: boolean }) {
  const pending = client.arcoRequests;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
          Datos personales
          <InfoTip label="Derechos ARCO">
            Por la Ley 29733, el cliente puede pedir acceso a sus datos, corregirlos, que se eliminen o que no se usen para algo. Desde su portal envía la solicitud y la agencia tiene 10 días hábiles para responder, o 20 si pide acceso.
          </InfoTip>
        </h3>
        {pending.length > 0 && <Badge tone="warn">{pending.length === 1 ? "1 solicitud" : `${pending.length} solicitudes`}</Badge>}
      </div>
      {pending.length === 0 ? (
        <p className="text-[13px] text-fg-2">Sin solicitudes pendientes sobre sus datos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pending.map((request) => (
            <li key={request.code} className="text-[13px] text-fg-2">
              <b className="font-semibold text-fg">{request.subject.replace("Solicitud ARCO · ", "")}</b> · {request.code}
              {request.dueDate && <span className="text-fg-3"> · responder hasta el {formatDate(request.dueDate)}</span>}
            </li>
          ))}
        </ul>
      )}
      {canErase && (
        <div className="mt-3 border-t border-line-2 pt-3">
          <ClientAnonymizeAction client={client} />
        </div>
      )}
    </Card>
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
