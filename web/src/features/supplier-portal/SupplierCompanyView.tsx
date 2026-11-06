"use client";

import { Building2, CalendarRange, ClipboardList, FileSignature, Landmark, Mail, Phone, Plus, Tags, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteContact, saveContact } from "@/app/(proveedor)/proveedor/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { ConfirmAction, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { Stars, UsageBar } from "@/features/channels/ChannelUi";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { SupplierCompany, SupplierContact } from "@/lib/supplier-portal";
import { toneStyle, type Tone } from "@/lib/tone";

function ContactPanel({ contact }: { contact?: SupplierContact }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={contact ? "Editar contacto" : "Agregar contacto"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      size="sm"
      formId={`contacto-${contact?.id ?? "nuevo"}`}
      trigger={contact ? (open) => <RowIcon tone="edit" label="Editar contacto" onClick={open} /> : undefined}
      title={contact ? "Editar contacto" : "Agregar contacto"}
      description="La agencia usa estos contactos para solicitudes, rooming lists y pagos."
      submitLabel={contact ? "Guardar" : "Agregar"}
      action={saveContact.bind(null, contact?.id ?? null)}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required minLength={3} maxLength={150} defaultValue={contact?.name ?? ""} icon={<UserRound size={17} />} />
          <TextField label="Cargo o área" name="role" maxLength={80} defaultValue={contact?.role ?? ""} placeholder="Reservas, Recepción, Contabilidad" />
          <TextField label="Teléfono" name="phone" type="tel" maxLength={30} defaultValue={contact?.phone ?? ""} icon={<Phone size={17} />} />
          <TextField label="Correo" name="email" type="email" maxLength={190} defaultValue={contact?.email ?? ""} icon={<Mail size={17} />} />
        </>
      )}
    </PanelAction>
  );
}

export function SupplierCompanyView({ data }: { data: SupplierCompany }) {
  const { provider, contract } = data;
  const total = Math.max(1, (new Date(contract.end).getTime() - new Date(contract.start).getTime()) / 86400000);
  const elapsed = Math.min(100, Math.max(0, ((total - contract.days_left) / total) * 100));
  const contractTone: Tone = contract.days_left < 0 ? "bad" : contract.days_left < 60 ? "warn" : "ok";

  return (
    <>
      <PortalTitle title="Mi empresa" subtitle="Sus datos registrados en la agencia, el contrato vigente y los contactos con los que coordinan." />

      {contract.alert && (
        <div style={toneStyle(contractTone)} className={cn("mb-5 flex items-start gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-4 py-3", RISE)}>
          <FileSignature size={18} className="mt-0.5 flex-none text-[var(--tint)]" />
          <p className="text-[13.5px] text-fg-2">
            <b className="text-[var(--tint)]">{contract.alert}.</b> {contract.days_left < 0 ? "La agencia no puede solicitarle nuevos servicios hasta renovarlo." : "Coordine la renovación con la agencia para seguir recibiendo solicitudes."}
          </p>
        </div>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={ClipboardList} tone="t1" label="Servicios atendidos" value={data.activity.services} note={`En ${data.activity.reservations} reservas`} />
        <TintTile icon={Tags} tone="t3" label="Servicios en catálogo" value={data.activity.catalog} note="Activos con tarifa neta" />
        <TintTile icon={CalendarRange} tone={contractTone} label="Vigencia del contrato" value={contract.days_left < 0 ? "Vencido" : `${contract.days_left} días`} note={`Hasta el ${formatDate(contract.end)}`} />
        <TintTile icon={Users} tone="violet" label="Contactos" value={data.contacts.length} note={`${data.users.length} ${data.users.length === 1 ? "usuario" : "usuarios"} en la extranet`} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={Building2} title="Datos de la empresa" aside={<Badge tone={provider.status === "activo" ? "ok" : "bad"}>{capitalize(provider.status)}</Badge>}>
            <FieldList
              fields={[
                { label: "Razón social", value: provider.name },
                { label: "RUC", value: <span className="font-mono">{provider.ruc}</span> },
                { label: "Tipo", value: provider.stars ? <span className="inline-flex items-center gap-2">{provider.type} <Stars value={provider.stars} size={12} /></span> : provider.type },
                { label: "Ciudad", value: provider.city ?? "—" },
                { label: "Moneda", value: provider.currency },
                { label: "Condición de pago", value: provider.payment_terms ?? "—" },
                { label: "Contacto principal", value: provider.contact },
                { label: "Correo", value: provider.email ?? "—" },
                { label: "Teléfono", value: provider.phone ?? "—" },
              ]}
            />
            <p className="mt-3 text-[12px] text-fg-3">Para cambiar la razón social, el RUC o las condiciones del contrato escriba a Compras de la agencia.</p>
          </SectionCard>

          <SectionCard icon={Users} title="Contactos" aside={<ContactPanel />}>
            {data.contacts.length === 0 ? (
              <EmptyLine>Agregue al menos un contacto para que la agencia sepa a quién escribir.</EmptyLine>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {data.contacts.map((contact, index) => (
                  <li key={contact.id} style={rise(index)} className={cn("lift flex items-start gap-3 rounded-tile border border-line bg-surface px-3.5 py-3", RISE)}>
                    <Avatar name={contact.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{contact.name}</b>
                      {contact.role && <span className="block truncate text-[12px] text-fg-3">{contact.role}</span>}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-fg-2 transition hover:text-t1">
                          <Mail size={13} /> {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[12.5px] text-fg-2 transition hover:text-t1">
                          <Phone size={13} /> {contact.phone}
                        </a>
                      )}
                    </span>
                    <RowActions>
                      <ContactPanel contact={contact} />
                      {data.contacts.length > 1 ? (
                        <ConfirmAction id={`contacto-${contact.id}`} label="Quitar contacto" title={`Quitar a ${contact.name}`} description="La agencia dejará de verlo como contacto de su empresa." submitLabel="Quitar" action={deleteContact.bind(null, contact.id)} hidden={{}} />
                      ) : (
                        <RowIcon tone="delete" label="Quitar contacto" disabledHint="La agencia necesita al menos un contacto" />
                      )}
                    </RowActions>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard icon={FileSignature} title="Contrato">
            <FieldList
              fields={[
                { label: "Inicio", value: formatDate(contract.start) },
                { label: "Fin", value: formatDate(contract.end) },
                { label: "Restan", value: contract.days_left < 0 ? "Vencido" : `${contract.days_left} días` },
              ]}
            />
            <div className="mt-3" title={`${Math.round(elapsed)} % del contrato transcurrido`}>
              <UsageBar pct={elapsed} tone={contractTone} />
            </div>
          </SectionCard>
          <SectionCard icon={Landmark} title="Facturar a">
            <FieldList
              fields={[
                { label: "Razón social", value: <span className="whitespace-normal">{data.agency.legal_name ?? data.agency.name}</span> },
                { label: "RUC", value: <span className="font-mono">{data.agency.ruc ?? "—"}</span> },
                { label: "Dirección fiscal", value: <span className="whitespace-normal">{data.agency.address ?? "—"}</span> },
              ]}
            />
          </SectionCard>
          <SectionCard icon={UserRound} title="Usuarios de la extranet" aside={data.users.length}>
            <ul className="flex flex-col gap-2">
              {data.users.map((user, index) => (
                <li key={user.email} style={rise(index)} className={cn("flex items-center gap-3 rounded-tile border border-line px-3 py-2.5", RISE)}>
                  <Avatar name={user.name} size="sm" tone="t3" solid />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold">{user.email}</b>
                    <span className="block text-[12px] text-fg-3">{user.last_login_at ? `Último ingreso ${formatDateTime(user.last_login_at)}` : "Aún no ingresa"}</span>
                  </span>
                  <Badge tone={user.status === "activo" ? "ok" : "mute"}>{capitalize(user.status)}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
