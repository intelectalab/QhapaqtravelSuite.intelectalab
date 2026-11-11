"use client";

import { AlertTriangle, Ban, BellRing, CheckCheck, CircleOff, Clock, Eye, FlaskConical, Mail, MessageCircle, MonitorSmartphone, Plus, Power, PowerOff, RefreshCw, RotateCcw, Send, SendHorizontal, Smartphone, Trash2, Variable, X, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { createPaxTemplate, deletePaxTemplate, paxMessageStep, reschedulePaxMessages, sendPaxMessage, testPaxTemplate, togglePaxTemplate, updatePaxTemplate } from "@/app/(backoffice)/admin/comunicaciones/actions";
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
import { ADMIN_INITIAL, CHANNEL_LABELS, fillTemplate, offsetLabel, type AdminActionState, type Option, type PaxMessage, type PaxTemplate, type PaxTemplatesOverview } from "@/lib/admin";
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

function ProductPicker({ options, defaultValues }: { options: PaxTemplatesOverview["products"]; defaultValues: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  const available = options.filter((option) => !selected.includes(option.value));
  return (
    <div>
      <SelectField key={selected.join(",")} label="Solo para estos productos" name="product_picker" options={available} searchable placeholder={selected.length > 0 ? "Agregar otro producto" : "Todos los productos"} onChange={(value) => value && setSelected([...selected, value])} />
      {selected.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {selected.map((value) => (
            <li key={value} className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-3 py-1.5 text-[12.5px]">
              <input type="hidden" name="products" value={value} />
              <span className="truncate">{options.find((option) => option.value === value)?.label ?? value}</span>
              <button type="button" onClick={() => setSelected(selected.filter((item) => item !== value))} className="text-fg-3 transition-colors hover:text-bad" aria-label="Quitar producto">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
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
      <div>
        <FieldLabel hint="Sin marcar: todos los canales de venta.">Canales de venta</FieldLabel>
        <CheckChips name="sales_channels" options={data.sales_channels} defaultValues={template?.sales_channels ?? []} />
      </div>
      <ProductPicker options={data.products} defaultValues={template?.products ?? []} />
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
            {() => (
              <>
                <input type="hidden" name="code" value={template.code} />
                <input type="hidden" name="active" value={template.active ? "0" : "1"} />
              </>
            )}
          </PanelAction>
          <PanelAction<AdminActionState> label="Probar" variant="ghost" size="sm" formId={`pax-test-${template.code}`} trigger={(open) => <RowIcon tone="neutral" label="Enviar prueba" icon={<FlaskConical size={15} />} onClick={open} />} title="Enviar prueba" description={`${template.name} llega a tu correo con los datos de una reserva vigente.`} submitLabel="Enviar prueba" action={testPaxTemplate} initial={ADMIN_INITIAL}>
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

const MESSAGE_STATUS: Record<PaxMessage["status"], { label: string; tone: Tone }> = {
  programado: { label: "Programado", tone: "info" },
  enviado: { label: "Enviado", tone: "t1" },
  entregado: { label: "Entregado", tone: "ok" },
  leido: { label: "Leído", tone: "ok" },
  fallido: { label: "Fallido", tone: "bad" },
  cancelado: { label: "Cancelado", tone: "mute" },
};

const STEPS = {
  send: { label: "Enviar ahora", icon: <SendHorizontal size={15} />, title: "Enviar ahora", text: "Sale en este momento por el canal programado; la fecha original se descarta." },
  cancel: { label: "Cancelar envío", icon: <Ban size={15} />, title: "Cancelar envío", text: "El mensaje queda cancelado en el historial. Si es automático, no se vuelve a programar para esta reserva y canal hasta recalcular." },
  retry: { label: "Reintentar", icon: <RotateCcw size={15} />, title: "Reintentar envío", text: "Se vuelve a enviar con el mismo contenido. Revisa antes el contacto del pasajero." },
} as const;

function MessageStep({ message, step }: { message: PaxMessage; step: keyof typeof STEPS }) {
  const meta = STEPS[step];
  return (
    <PanelAction<AdminActionState> label={meta.label} variant="ghost" size="sm" formId={`pax-${step}-${message.code}`} trigger={(open) => <RowIcon tone={step === "cancel" ? "delete" : "neutral"} label={meta.label} icon={meta.icon} onClick={open} />} title={meta.title} description={`${message.code} · ${message.recipient}`} submitLabel={meta.label} action={paxMessageStep} initial={ADMIN_INITIAL}>
      {() => (
        <>
          <input type="hidden" name="message" value={message.code} />
          <input type="hidden" name="step" value={step} />
          <p className="text-[13px] text-fg-2">{meta.text}</p>
          {message.error && <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[12.5px] text-bad">Último error: {message.error}</p>}
        </>
      )}
    </PanelAction>
  );
}

function ManualFields({ data }: { data: PaxTemplatesOverview }) {
  const [template, setTemplate] = useState("");
  const [channel, setChannel] = useState("email");
  const chosen = data.templates.find((item) => item.code === template);
  return (
    <>
      <SelectField label="Reserva" name="reservation" options={data.reservations} searchable placeholder="Elige la reserva" />
      <ChoiceGroup label="Canal" name="channel" options={data.channels.filter((option) => option.value !== "push")} defaultValue={channel} onChange={setChannel} />
      <SelectField label="Plantilla (opcional)" name="template" options={data.templates.filter((item) => item.active && item.channels.includes(channel)).map((item) => ({ value: item.code, label: item.name }))} value={template} onChange={setTemplate} clearable placeholder="Mensaje libre" />
      {!chosen && (
        <>
          {channel !== "whatsapp" && <TextField label="Asunto" name="subject" maxLength={200} required />}
          <TextArea label="Mensaje" name="body" rows={5} required minLength={10} maxLength={channel === "whatsapp" ? 1024 : 4000} hint="Admite las mismas variables que las plantillas, como {{pasajero}} o {{reserva}}." />
        </>
      )}
      {chosen && <MessagePreview subject={chosen.subject} body={chosen.body} channel={channel} sample={data.sample} />}
      <TextField label="Programar para (opcional)" name="scheduled_at" type="datetime-local" hint="Vacío: sale ahora." />
    </>
  );
}

export function PaxMessageManualAction({ data }: { data: PaxTemplatesOverview }) {
  return (
    <PanelAction<AdminActionState> label="Nuevo mensaje" icon={<Send size={15} />} variant="primary" size="sm" formId="pax-manual" title="Mensaje al pasajero" description="Envío manual a una reserva vigente: queda con tu usuario en el historial." submitLabel="Enviar" action={sendPaxMessage} initial={ADMIN_INITIAL}>
      {() => <ManualFields data={data} />}
    </PanelAction>
  );
}

export function PaxRescheduleAction() {
  return (
    <PanelAction<AdminActionState> label="Recalcular" icon={<RefreshCw size={15} />} size="sm" formId="pax-reschedule" title="Recalcular programación" description="Vuelve a calcular los envíos automáticos de todas las reservas vigentes con las plantillas y reglas actuales. No reenvía momentos que ya pasaron." submitLabel="Recalcular" action={reschedulePaxMessages} initial={ADMIN_INITIAL}>
      {() => <p className="text-[13px] text-fg-2">El sistema también lo hace solo cada 15 minutos y cada vez que cambias una plantilla.</p>}
    </PanelAction>
  );
}

export function PaxMessagesTable({ messages, channels, mode, data }: { messages: PaxMessage[]; channels: Option[]; mode: "upcoming" | "history"; data?: PaxTemplatesOverview }) {
  const upcoming = mode === "upcoming";
  const canSend = data?.can_send ?? false;
  const [now] = useState(() => Date.now());
  const columns: Column<PaxMessage>[] = [
    {
      id: "message",
      header: "Mensaje",
      mobile: "title",
      cell: (message) => (
        <div className="min-w-0 max-w-[320px]">
          <p className="truncate text-[13.5px] font-semibold" title={message.subject ?? undefined}>
            {message.template_name ?? message.subject ?? "Mensaje libre"}
          </p>
          <p className="text-[11.5px] text-fg-3">
            <span className="font-mono">{message.code}</span> · {message.origin === "auto" ? "automático" : message.origin === "prueba" ? "prueba" : "manual"}
            {message.direction === "entrante" && " · respuesta del pasajero"}
          </p>
        </div>
      ),
    },
    {
      id: "reservation",
      header: "Reserva",
      cell: (message) =>
        message.reservation ? (
          <a href={`/reservas/${message.reservation}`} className="flex flex-col hover:text-accent">
            <span className="font-mono text-[12.5px] font-semibold">{message.reservation}</span>
            {message.reservation_title && <span className="max-w-[220px] truncate text-[11.5px] text-fg-3">{message.reservation_title}</span>}
          </a>
        ) : (
          <span className="text-[12.5px] text-fg-3">Sin reserva</span>
        ),
    },
    { id: "channel", header: "Canal", cell: (message) => <ChannelChips channels={[message.channel]} /> },
    { id: "to", header: "Para", wideOnly: true, cell: (message) => <span className="text-[13px]">{message.recipient}</span> },
    ...(upcoming
      ? []
      : [
          {
            id: "status",
            header: "Estado",
            cell: (message: PaxMessage) => (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={MESSAGE_STATUS[message.status].tone}>{MESSAGE_STATUS[message.status].label}</Badge>
                {message.error && (
                  <span className="max-w-[220px] truncate text-[11.5px] text-bad" title={message.error}>
                    {`${message.attempts} ${message.attempts === 1 ? "intento" : "intentos"} · ${message.error}`}
                  </span>
                )}
              </span>
            ),
          },
        ]),
    { id: "at", header: upcoming ? "Sale el" : "Fecha", align: "right", cell: (message) => <span className="text-[12.5px] text-fg-3">{formatDateTime((upcoming ? message.scheduled_at : message.sent_at) ?? message.at, false)}</span> },
    ...(canSend
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            mobile: "detail" as const,
            cell: (message: PaxMessage) => (
              <RowActions>
                {message.status === "programado" ? (
                  <>
                    <MessageStep message={message} step="send" />
                    <MessageStep message={message} step="cancel" />
                  </>
                ) : message.status === "fallido" && message.direction === "saliente" ? (
                  <MessageStep message={message} step="retry" />
                ) : (
                  <RowIcon tone="neutral" label="Reintentar" icon={<RotateCcw size={15} />} disabledHint="Solo se reintenta un envío fallido" />
                )}
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const soon = (message: PaxMessage) => message.scheduled_at !== null && new Date(message.scheduled_at).getTime() - now <= 48 * 3600 * 1000;
  const metrics: MetricFilter<PaxMessage>[] = upcoming
    ? [
        { id: "soon", label: "En las próximas 48 h", tone: "sun", icon: <Clock size={19} />, matches: soon },
        { id: "auto", label: "Automáticos", tone: "t1", icon: <BellRing size={19} />, matches: (message) => message.origin === "auto" },
        { id: "manual", label: "Manuales", tone: "violet", icon: <Send size={19} />, matches: (message) => message.origin !== "auto" },
      ]
    : [
        { id: "read", label: "Leídos", tone: "ok", icon: <Eye size={19} />, matches: (message) => message.status === "leido" },
        { id: "delivered", label: "Entregados sin leer", tone: "t1", icon: <CheckCheck size={19} />, matches: (message) => message.status === "entregado" || message.status === "enviado" },
        { id: "failed", label: "Fallidos", tone: "bad", icon: <XCircle size={19} />, matches: (message) => message.status === "fallido" },
        { id: "canceled", label: "Cancelados", tone: "mute", icon: <CircleOff size={19} />, matches: (message) => message.status === "cancelado" },
      ];
  const templates = [...new Map(messages.filter((message) => message.template).map((message) => [message.template as string, message.template_name ?? (message.template as string)])).entries()].map(([value, label]) => ({ value, label }));
  const filters: FilterConfig<PaxMessage>[] = [
    { id: "channel", label: "Canal", options: channels, value: (message) => message.channel },
    { id: "template", label: "Plantilla", options: templates, value: (message) => message.template ?? "" },
  ];
  const sorts: SortOption<PaxMessage>[] = [{ id: "at", label: upcoming ? "Programado" : "Fecha", type: "date", value: (message) => (upcoming ? message.scheduled_at : message.at) }];
  return (
    <DataTable
      screen={upcoming ? "admin-comunicaciones-proximos" : "admin-comunicaciones-historial"}
      rows={messages}
      columns={columns}
      getKey={(message) => message.code}
      entityLabel="mensajes"
      searchText={(message) => `${message.code} ${message.reservation ?? ""} ${message.recipient} ${message.subject ?? ""} ${message.template_name ?? ""}`}
      searchPlaceholder="Buscar reserva, pasajero o mensaje"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle={upcoming ? "No hay envíos programados" : "Aún no hay mensajes enviados"}
      toolbarEnd={upcoming && canSend && data ? (
        <span className="flex flex-wrap gap-2">
          <PaxRescheduleAction />
          <PaxMessageManualAction data={data} />
        </span>
      ) : undefined}
    />
  );
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
