"use client";

import { Ban, CheckCheck, CircleSlash, FileCheck2, Mail, MessageCircle, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { useState } from "react";
import { consentStep } from "@/app/(backoffice)/marketing/campanas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { Timeline } from "@/features/channels/ChannelUi";
import { formatDate, formatDateTime } from "@/lib/format";
import { addressOf, CHANNEL_LABELS, consentOf, type ConsentChannel, type ConsentRecord, type ConsentsOverview, type MarketingContact } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const CHANNELS: ConsentChannel[] = ["email", "whatsapp"];

const STATE_OPTIONS = [
  { value: "otorgado", label: "Otorgado" },
  { value: "revocado", label: "Baja" },
  { value: "sin", label: "Sin registro" },
];

const stateOf = (record: ConsentRecord | null) => record?.status ?? "sin";

const granted = (contact: MarketingContact) => CHANNELS.filter((channel) => consentOf(contact, channel)?.status === "otorgado").length;

function ConsentBadge({ record }: { record: ConsentRecord | null }) {
  if (!record) return <Badge tone="mute">Sin consentimiento</Badge>;
  return record.status === "otorgado" ? <Badge tone="ok">Otorgado</Badge> : <Badge tone="bad">Baja</Badge>;
}

function ConsentCell({ contact, channel }: { contact: MarketingContact; channel: ConsentChannel }) {
  const record = consentOf(contact, channel);
  const address = addressOf(contact, channel);
  const detail = record ? (record.status === "otorgado" ? `${formatDate(record.granted_at)} · ${record.source}` : `Baja ${record.revoked_at ? formatDate(record.revoked_at) : ""} · ${record.revoke_source ?? ""}`) : (address ?? (channel === "email" ? "Sin correo" : "Sin móvil"));
  return (
    <div className="min-w-0">
      <ConsentBadge record={record} />
      <span className="mt-1 block max-w-[210px] truncate text-[12px] text-fg-3" title={detail}>{detail}</span>
    </div>
  );
}

function GrantAction({ contact, channel, record, sources }: { contact: MarketingContact; channel: ConsentChannel; record: ConsentRecord | null; sources: ConsentsOverview["sources"] }) {
  const address = addressOf(contact, channel);
  return (
    <PanelAction<StepResult>
      label="Registrar consentimiento"
      formId={`consentir-${contact.key}-${channel}`}
      title={`Registrar consentimiento · ${CHANNEL_LABELS[channel]}`}
      description={`${contact.name}. Sin origen ni evidencia no se registra; no se admiten casillas pre-marcadas.`}
      submitLabel="Registrar"
      action={consentStep}
      initial={initial}
      trigger={(open) => (
        <Button size="sm" variant="primary" icon={<CheckCheck size={14} />} onClick={open} disabled={!address} title={address ? undefined : channel === "email" ? "El contacto no tiene correo" : "El contacto no tiene un celular válido"}>
          Registrar consentimiento
        </Button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="step" value="grant" />
          <input type="hidden" name="subject_type" value={contact.type} />
          <input type="hidden" name="subject_id" value={contact.id} />
          <input type="hidden" name="channel" value={channel} />
          {record && <input type="hidden" name="lock_version" value={record.lock_version} />}
          <SelectField label="Origen" name="source" options={sources.grant.map((source) => ({ value: source, label: source }))} placeholder="Elegir origen" />
          <TextField label="Evidencia" name="evidence" required minLength={4} maxLength={500} icon={<FileCheck2 size={17} />} hint="IP, ID de formulario, grabación o ficha firmada." />
          <TextField label="Versión de la política informada" name="policy_version" required maxLength={20} defaultValue={sources.policy_version} icon={<ShieldCheck size={17} />} />
        </>
      )}
    </PanelAction>
  );
}

function RevokeAction({ contact, record, sources }: { contact: MarketingContact; record: ConsentRecord; sources: ConsentsOverview["sources"] }) {
  return (
    <PanelAction<StepResult>
      label="Registrar baja"
      formId={`baja-${record.code}`}
      title={`Registrar baja · ${CHANNEL_LABELS[record.channel]}`}
      description={`${contact.name}. La baja se aplica de inmediato: sale de las campañas y automatizaciones comerciales por este canal.`}
      submitLabel="Registrar baja"
      action={consentStep}
      initial={initial}
      trigger={(open) => (
        <Button size="sm" variant="secondary" icon={<Ban size={14} />} onClick={open}>
          Registrar baja
        </Button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="step" value="revoke" />
          <input type="hidden" name="code" value={record.code} />
          <input type="hidden" name="lock_version" value={record.lock_version} />
          <SelectField label="Origen de la baja" name="source" options={sources.revoke.map((source) => ({ value: source, label: source }))} placeholder="Elegir origen" />
        </>
      )}
    </PanelAction>
  );
}

function ChannelCard({ contact, channel, overview }: { contact: MarketingContact; channel: ConsentChannel; overview: ConsentsOverview }) {
  const record = consentOf(contact, channel);
  const address = addressOf(contact, channel);
  const Icon = channel === "email" ? Mail : MessageCircle;
  const rows: [string, string][] = record
    ? [
        ["Otorgado", formatDateTime(record.granted_at)],
        ["Origen", record.source],
        ["Evidencia", record.evidence],
        ["Política", record.policy_version],
        ...(record.status === "revocado" ? ([["Baja", `${record.revoked_at ? formatDateTime(record.revoked_at) : ""} · ${record.revoke_source ?? ""}${record.revoke_campaign ? ` (${record.revoke_campaign})` : ""}`]] as [string, string][]) : []),
      ]
    : [];
  return (
    <section style={toneStyle(channel === "email" ? "info" : "ok")} className="lift rounded-tile border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
            <Icon size={16} />
          </span>
          <span>
            <b className="block text-[14px]">{CHANNEL_LABELS[channel]}</b>
            <span className="block text-[12px] text-fg-3">{address ?? "Sin dato de contacto válido"}</span>
          </span>
        </span>
        <ConsentBadge record={record} />
      </header>
      {record ? (
        <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[82px_1fr] gap-2">
              <dt className="text-fg-3">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">Sin consentimiento registrado: se suprime de todas las campañas por {CHANNEL_LABELS[channel]}.</p>
      )}
      {overview.can.manage && (
        <div className="mt-3 flex gap-2">{record?.status === "otorgado" ? <RevokeAction contact={contact} record={record} sources={overview.sources} /> : <GrantAction contact={contact} channel={channel} record={record} sources={overview.sources} />}</div>
      )}
    </section>
  );
}

function ContactSheet({ contact, overview, onClose }: { contact: MarketingContact | null; overview: ConsentsOverview; onClose: () => void }) {
  return (
    <SidePanel open={contact !== null} onOpenChange={(open) => !open && onClose()} title={contact?.name ?? "Contacto"} description={contact ? `${contact.type_label} · ${contact.code} · consentimientos por canal (Ley 29733)` : undefined}>
      {contact && (
        <div className="flex flex-col gap-3">
          {CHANNELS.map((channel) => (
            <ChannelCard key={channel} contact={contact} channel={channel} overview={overview} />
          ))}
          <div>
            <p className="mb-2 mt-2 text-[13px] font-semibold">Historial</p>
            <Timeline
              items={contact.history.map((event, index) => ({
                key: `${event.consent_code}-${event.occurred_at}-${index}`,
                title: `${CHANNEL_LABELS[event.channel]} · ${event.event === "otorgado" ? "Consentimiento otorgado" : "Baja registrada"}`,
                meta: `${formatDateTime(event.occurred_at)} · ${event.actor ?? "Titular o sistema"}`,
                note: event.evidence ? `${event.source} · ${event.evidence}` : event.source,
              }))}
            />
          </div>
          <p className="text-[12px] text-fg-3">Los registros no se eliminan: son la evidencia ante la ANPD. Una baja solo se revierte con un nuevo consentimiento expreso.</p>
          {contact.href && (
            <Button href={contact.href} variant="ghost" size="sm" icon={<UserRound size={14} />}>
              Abrir ficha en CRM
            </Button>
          )}
        </div>
      )}
    </SidePanel>
  );
}

export function ConsentBook({ overview }: { overview: ConsentsOverview }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = overview.contacts.find((contact) => contact.key === selected) ?? null;
  const columns: Column<MarketingContact>[] = [
    {
      id: "contact",
      header: "Contacto",
      mobile: "title",
      cell: (row) => (
        <button type="button" onClick={() => setSelected(row.key)} className="min-w-0 text-left">
          <b className="block max-w-[280px] truncate text-[13.5px] hover:text-accent">{row.name}</b>
          <span className="block text-[12px] text-fg-3">{row.type_label} · {row.code}</span>
        </button>
      ),
    },
    { id: "email", header: "Email", cell: (row) => <ConsentCell contact={row} channel="email" /> },
    { id: "whatsapp", header: "WhatsApp", cell: (row) => <ConsentCell contact={row} channel="whatsapp" /> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Gestionar consentimientos" onClick={() => setSelected(row.key)} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<MarketingContact>[] = [
    { id: "both", label: "Ambos canales", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => granted(row) === 2 },
    { id: "revoked", label: "Con baja", tone: "bad", icon: <ShieldOff size={19} />, matches: (row) => CHANNELS.some((channel) => consentOf(row, channel)?.status === "revocado") },
    { id: "none", label: "Sin registro", tone: "mute", icon: <CircleSlash size={19} />, matches: (row) => !row.email_consent && !row.whatsapp_consent },
  ];
  const filters: FilterConfig<MarketingContact>[] = [
    { id: "type", label: "Tipo", options: [{ value: "client", label: "Cliente" }, { value: "lead", label: "Lead" }, { value: "subscriber", label: "Suscriptor" }], value: (row) => row.type },
    { id: "email", label: "Email", options: STATE_OPTIONS, value: (row) => stateOf(row.email_consent) },
    { id: "whatsapp", label: "WhatsApp", options: STATE_OPTIONS, value: (row) => stateOf(row.whatsapp_consent) },
  ];
  const sorts: SortOption<MarketingContact>[] = [
    { id: "name", label: "Nombre", type: "text", value: (row) => row.name },
    { id: "granted", label: "Último otorgamiento", type: "date", value: (row) => [row.email_consent?.granted_at, row.whatsapp_consent?.granted_at].filter(Boolean).sort().pop() ?? null },
  ];
  return (
    <>
      <DataTable screen="marketing-consentimientos" rows={overview.contacts} columns={columns} getKey={(row) => row.key} entityLabel="contactos" searchText={(row) => `${row.name} ${row.code} ${row.email ?? ""} ${row.mobile ?? ""}`} searchPlaceholder="Buscar contacto, correo o teléfono" metrics={metrics} filters={filters} sorts={sorts} />
      <ContactSheet contact={current} overview={overview} onClose={() => setSelected(null)} />
    </>
  );
}
