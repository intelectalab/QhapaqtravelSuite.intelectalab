"use client";

import { AlertTriangle, BellRing, CircleOff, Mail, MessageCircle, MonitorSmartphone, Plus, Power, PowerOff, Send, Smartphone, Trash2, Variable } from "lucide-react";
import { useRef, useState } from "react";
import { createPaxTemplate, deletePaxTemplate, togglePaxTemplate, updatePaxTemplate } from "@/app/(backoffice)/admin/comunicaciones/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { ADMIN_INITIAL, CHANNEL_LABELS, fillTemplate, offsetLabel, type AdminActionState, type PaxTemplate, type PaxTemplatesOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";
import { CheckChips, FieldLabel, ToggleField } from "./AdminParts";

const CHANNEL_ICONS: Record<string, typeof Mail> = { email: Mail, whatsapp: MessageCircle, portal: MonitorSmartphone, push: Smartphone };
const CHANNEL_TONES: Record<string, Tone> = { email: "t1", whatsapp: "ok", portal: "violet", push: "sun" };

export function ChannelChips({ channels }: { channels: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {channels.map((channel) => {
        const Icon = CHANNEL_ICONS[channel] ?? Mail;
        return (
          <span key={channel} style={toneStyle(CHANNEL_TONES[channel] ?? "mute")} title={CHANNEL_LABELS[channel] ?? channel} className="tint-soft grid h-7 w-7 place-items-center rounded-lg transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110">
            <Icon size={14} />
          </span>
        );
      })}
    </span>
  );
}

function Highlighted({ text, missing }: { text: string; missing: string[] }) {
  if (missing.length === 0) return <>{text}</>;
  const parts = text.split(/(\{\{\s*[a-z_]+\s*\}\})/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\{\{/.test(part) ? (
          <mark key={index} className="rounded bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-1 text-warn" title="Se completa con los datos de cada reserva">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function MessagePreview({ subject, body, channel, sample }: { subject: string | null; body: string; channel: string; sample: PaxTemplatesOverview["sample"] }) {
  const filledSubject = fillTemplate(subject ?? "", sample.values);
  const filledBody = fillTemplate(body, sample.values);
  const whatsapp = channel === "whatsapp";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-fg-3">{sample.reservation ? `Con los datos de la reserva ${sample.reservation}.` : "Sin reservas vigentes: las variables se muestran resaltadas."}</p>
      <div className={cn("rounded-[16px] p-3.5 text-[13px] leading-relaxed", whatsapp ? "ml-6 rounded-tr-[4px] bg-[color-mix(in_srgb,var(--ok)_14%,var(--surface))]" : "border border-line bg-surface")}>
        {!whatsapp && subject && (
          <p className="mb-2 border-b border-line-2 pb-2 font-semibold">
            <Highlighted text={filledSubject.text} missing={filledSubject.missing} />
          </p>
        )}
        <p className="whitespace-pre-line">
          <Highlighted text={filledBody.text} missing={filledBody.missing} />
        </p>
      </div>
      {filledBody.missing.length > 0 && <p className="text-[11.5px] text-fg-3">Resaltado: {filledBody.missing.map((key) => `{{${key}}}`).join(", ")} se completa al enviar.</p>}
    </div>
  );
}

function TemplateFields({ data, template }: { data: PaxTemplatesOverview; template?: PaxTemplate }) {
  const [body, setBody] = useState(template?.body ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [channel, setChannel] = useState(template?.channels[0] ?? "email");
  const caret = useRef<{ start: number; end: number } | null>(null);
  const insert = (key: string) => {
    const token = `{{${key}}}`;
    const { start, end } = caret.current ?? { start: body.length, end: body.length };
    setBody(body.slice(0, start) + token + body.slice(end));
    caret.current = { start: start + token.length, end: start + token.length };
  };

  return (
    <>
      {template && <input type="hidden" name="code" value={template.code} />}
      <TextField label="Nombre" name="name" required minLength={3} defaultValue={template?.name} placeholder="Ej.: 48 h antes: recojo" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Momento del viaje" name="event" options={data.events} defaultValue={template?.event ?? "viaje"} />
        <TextField label="Desfase (horas)" name="offset_hours" type="number" min={-720} max={720} required defaultValue={template?.offset_hours ?? 0} hint="Negativo = antes del momento" />
      </div>
      <div>
        <FieldLabel hint="Al menos uno. WhatsApp no usa asunto.">Canales</FieldLabel>
        <CheckChips name="channels" options={data.channels} defaultValues={template?.channels ?? ["email"]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ChoiceGroup label="Idioma" name="lang" options={[{ value: "ES", label: "Español" }, { value: "EN", label: "Inglés" }]} defaultValue={template?.lang ?? "ES"} />
        <SelectField label="Solo si está activa la regla" name="requires_rule" options={data.rules.map((rule) => ({ value: rule.value, label: rule.label }))} defaultValue={template?.rule?.code ?? ""} placeholder="Siempre" />
      </div>
      <ToggleField label="Solo si hay saldo pendiente" name="only_if_balance" defaultChecked={template?.only_if_balance ?? false} />
      <ToggleField label="Solo si faltan datos de acompañantes" name="only_if_missing_docs" defaultChecked={template?.only_if_missing_docs ?? false} />
      <TextField label="Asunto" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} placeholder="Su reserva {{reserva}} está confirmada" />
      <div>
        <TextArea label="Mensaje" name="body" rows={7} required minLength={10} value={body} onChange={(event) => setBody(event.target.value)} onSelect={(event) => (caret.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} hint={`${body.length} caracteres · WhatsApp admite hasta 1 024`} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.variables.map((variable) => (
            <button key={variable.key} type="button" onClick={() => insert(variable.key)} title={variable.label} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-[11.5px] text-fg-2 transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent">
              <Variable size={12} />
              {variable.key}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-[14px] bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold">Vista previa</p>
          <span className="flex gap-1">
            {data.channels.map((option) => (
              <button key={option.value} type="button" onClick={() => setChannel(option.value)} className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors", channel === option.value ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}>
                {option.label}
              </button>
            ))}
          </span>
        </div>
        <MessagePreview subject={subject} body={body} channel={channel} sample={data.sample} />
      </div>
    </>
  );
}

export function PaxTemplateCreateAction({ data }: { data: PaxTemplatesOverview }) {
  return (
    <PanelAction<AdminActionState> label="Nueva plantilla" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" formId="pax-template-create" title="Nueva plantilla" description="Se programa sola para cada reserva vigente según el momento y el desfase." submitLabel="Crear plantilla" action={createPaxTemplate} initial={ADMIN_INITIAL}>
      {() => <TemplateFields data={data} />}
    </PanelAction>
  );
}

function PreviewIcon({ template, sample }: { template: PaxTemplate; sample: PaxTemplatesOverview["sample"] }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState(template.channels[0] ?? "email");
  return (
    <>
      <RowIcon tone="view" label="Vista previa" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={template.name} description={`${template.event_label} · ${offsetLabel(template.offset_hours)}${template.offset_from_rule ? " (según la regla)" : ""}`}>
        <div className="flex flex-col gap-4">
          <ChoiceGroup label="Canal" name="preview-channel" options={template.channels.map((value) => ({ value, label: CHANNEL_LABELS[value] ?? value }))} defaultValue={channel} onChange={setChannel} />
          <MessagePreview subject={template.subject} body={template.body} channel={channel} sample={sample} />
          <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
            <div className="rounded-[11px] bg-surface-2 px-3 py-2">
              <dt className="text-fg-3">Enviados</dt>
              <dd className="text-[16px] font-bold">{template.sent}</dd>
            </div>
            <div className="rounded-[11px] bg-surface-2 px-3 py-2">
              <dt className="text-fg-3">Fallidos</dt>
              <dd className={cn("text-[16px] font-bold", template.failed > 0 && "text-bad")}>{template.failed}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-fg-3">Última edición: {template.updated_by ?? "Sistema"} · {formatDateTime(template.updated_at)}</p>
        </div>
      </SidePanel>
    </>
  );
}

function TemplateRowActions({ template, data }: { template: PaxTemplate; data: PaxTemplatesOverview }) {
  return (
    <RowActions>
      <PreviewIcon template={template} sample={data.sample} />
      {data.can_manage && (
        <>
          <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId={`pax-edit-${template.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar plantilla" onClick={open} />} title="Editar plantilla" description={`${template.code} · los mensajes ya enviados no cambian.`} submitLabel="Guardar cambios" action={updatePaxTemplate} initial={ADMIN_INITIAL}>
            {() => <TemplateFields data={data} template={template} />}
          </PanelAction>
          <PanelAction<AdminActionState>
            label={template.active ? "Desactivar" : "Activar"}
            variant="ghost"
            size="sm"
            formId={`pax-toggle-${template.code}`}
            trigger={(open) => <RowIcon tone="neutral" label={template.active ? "Desactivar" : "Activar"} icon={template.active ? <PowerOff size={15} /> : <Power size={15} />} onClick={open} />}
            title={template.active ? "Desactivar plantilla" : "Activar plantilla"}
            description={template.active ? "Deja de programarse para nuevas reservas. Los mensajes ya programados se retiran." : "Se vuelve a programar para las reservas vigentes."}
            submitLabel={template.active ? "Desactivar" : "Activar"}
            action={togglePaxTemplate}
            initial={ADMIN_INITIAL}
          >
            {() => <input type="hidden" name="code" value={template.code} />}
          </PanelAction>
          {template.sent === 0 && (
            <PanelAction<AdminActionState> label="Eliminar" variant="ghost" size="sm" formId={`pax-delete-${template.code}`} trigger={(open) => <RowIcon tone="delete" label="Eliminar plantilla" icon={<Trash2 size={15} />} onClick={open} />} title="Eliminar plantilla" description={`${template.name} no tiene mensajes enviados, así que se puede eliminar.`} submitLabel="Eliminar" action={deletePaxTemplate} initial={ADMIN_INITIAL}>
              {() => <input type="hidden" name="code" value={template.code} />}
            </PanelAction>
          )}
        </>
      )}
    </RowActions>
  );
}

export function PaxTemplatesTable({ data }: { data: PaxTemplatesOverview }) {
  const columns: Column<PaxTemplate>[] = [
    {
      id: "template",
      header: "Plantilla",
      mobile: "title",
      cell: (template) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{template.name}</p>
          <p className="text-[11.5px] text-fg-3">
            <span className="font-mono">{template.code}</span> · {template.lang}
          </p>
        </div>
      ),
    },
    {
      id: "when",
      header: "Cuándo",
      cell: (template) => (
        <span className="text-[12.5px]">
          <b className="block font-semibold">{template.event_label}</b>
          <span className="text-fg-3">{offsetLabel(template.offset_hours)}</span>
        </span>
      ),
    },
    { id: "channels", header: "Canales", cell: (template) => <ChannelChips channels={template.channels} /> },
    {
      id: "condition",
      header: "Condición",
      wideOnly: true,
      cell: (template) =>
        template.rule ? (
          <Badge tone={template.rule.enabled ? "t1" : "warn"}>{template.rule.enabled ? template.rule.name : `${template.rule.name} (apagada)`}</Badge>
        ) : template.only_if_balance || template.only_if_missing_docs ? (
          <span className="text-[12.5px] text-fg-2">{template.only_if_balance ? "Con saldo pendiente" : "Faltan datos"}</span>
        ) : (
          <span className="text-[12.5px] text-fg-3">Siempre</span>
        ),
    },
    { id: "sent", header: "Envíos", align: "right", wideOnly: true, cell: (template) => <span className="font-mono text-[13px]">{template.sent}{template.failed > 0 && <span className="text-bad"> · {template.failed} fallidos</span>}</span> },
    { id: "status", header: "Estado", cell: (template) => <Badge tone={template.active ? "ok" : "mute"}>{template.active ? "Activa" : "Inactiva"}</Badge> },
    { id: "actions", header: "", align: "right", mobile: "detail", cell: (template) => <TemplateRowActions template={template} data={data} /> },
  ];
  const metrics: MetricFilter<PaxTemplate>[] = [
    { id: "active", label: "Activas", tone: "ok", icon: <BellRing size={19} />, matches: (template) => template.active },
    { id: "inactive", label: "Inactivas", tone: "mute", icon: <CircleOff size={19} />, matches: (template) => !template.active },
    { id: "whatsapp", label: "Con WhatsApp", tone: "t4", icon: <MessageCircle size={19} />, matches: (template) => template.channels.includes("whatsapp") },
    { id: "blocked", label: "Regla apagada", tone: "warn", icon: <AlertTriangle size={19} />, matches: (template) => template.rule !== null && !template.rule.enabled },
  ];
  const filters: FilterConfig<PaxTemplate>[] = [
    { id: "event", label: "Momento", options: data.events, value: (template) => template.event },
    { id: "channel", label: "Canal", options: data.channels, value: (template) => template.channels },
    { id: "lang", label: "Idioma", options: [{ value: "ES", label: "Español" }, { value: "EN", label: "Inglés" }], value: (template) => template.lang },
  ];
  const sorts: SortOption<PaxTemplate>[] = [
    { id: "offset", label: "Momento", type: "number", value: (template) => template.offset_hours },
    { id: "updated", label: "Última edición", type: "date", value: (template) => template.updated_at },
  ];
  return <DataTable screen="admin-comunicaciones" rows={data.templates} columns={columns} getKey={(template) => template.code} entityLabel="plantillas" searchText={(template) => `${template.name} ${template.code} ${template.subject ?? ""} ${template.body}`} searchPlaceholder="Buscar plantilla o texto" metrics={metrics} filters={filters} sorts={sorts} />;
}

export function VariablesCard({ data }: { data: PaxTemplatesOverview }) {
  return (
    <Card>
      <TintCardTitle icon={Send} title="Variables disponibles" aside={data.sample.reservation ? `Ejemplo: ${data.sample.reservation}` : undefined} />
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {data.variables.map((variable) => (
          <li key={variable.key} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2" title={variable.label}>
            <code className="font-mono text-accent">{`{{${variable.key}}}`}</code>
            <span className="truncate text-fg-2">{data.sample.values[variable.key] ?? variable.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
