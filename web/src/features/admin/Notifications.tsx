"use client";

import { CheckCircle2, Clock, Mail, RefreshCw, XCircle } from "lucide-react";
import { fallbackNotification, retryNotification, updateNotificationRule } from "@/app/(backoffice)/admin/notificaciones/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, CHANNEL_LABELS, type AdminActionState, type NotificationMessage, type NotificationRule, type NotificationsOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { RISE, ToggleField } from "./AdminParts";
import { ChannelChips } from "./PaxTemplates";

const CHANNELS = ["email", "whatsapp", "push", "portal"] as const;
const STATUS = { enviado: { label: "Enviado", tone: "ok" }, fallido: { label: "Fallido", tone: "bad" }, pendiente: { label: "En cola", tone: "sun" } } as const;

function RuleEditor({ rule, options }: { rule: NotificationRule; options: NotificationsOverview["options"] }) {
  return (
    <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId={`notif-${rule.event}`} trigger={(open) => <RowIcon tone="edit" label={`Editar ${rule.label}`} onClick={open} />} title={rule.label} description={rule.critical ? "La incidencia crítica debe avisarse por al menos un canal." : "Elige por dónde, a quién y cuándo se avisa."} submitLabel="Guardar regla" action={updateNotificationRule} initial={ADMIN_INITIAL}>
      {() => (
        <>
          <input type="hidden" name="event" value={rule.event} />
          <div className="grid gap-3 rounded-[14px] bg-surface-2 p-3.5">
            {CHANNELS.map((channel) => (
              <ToggleField key={channel} label={CHANNEL_LABELS[channel]} name={channel} defaultChecked={rule.channels[channel]} />
            ))}
          </div>
          <TextField label="Destinatarios" name="recipients" required minLength={3} defaultValue={rule.recipients} hint="Por ejemplo: Cliente + Operaciones" />
          <SelectField label="Cuándo se envía" name="timing" options={options.timings} defaultValue={rule.timing} />
          <SelectField label="Condición" name="condition" options={options.conditions} defaultValue={rule.condition} />
        </>
      )}
    </PanelAction>
  );
}

export function NotificationMatrix({ data }: { data: NotificationsOverview }) {
  const timing = (value: string) => data.options.timings.find((option) => option.value === value)?.label ?? value;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-fg-3">
            <th className="px-3 py-2 font-medium">Evento</th>
            {CHANNELS.map((channel) => (
              <th key={channel} className="px-2 py-2 text-center font-medium">
                {CHANNEL_LABELS[channel]}
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Destinatarios</th>
            <th className="px-3 py-2 font-medium">Cuándo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rules.map((rule, index) => (
            <tr key={rule.event} style={{ animationDelay: `${index * 35}ms` }} className={cn("group border-t border-line-2 transition-colors hover:bg-surface-2", RISE)}>
              <td className="px-3 py-2.5">
                <p className="flex items-center gap-1.5 font-semibold">
                  {rule.label}
                  {rule.critical && <Badge tone="bad">Crítico</Badge>}
                </p>
                <p className="font-mono text-[11.5px] text-fg-3">{rule.event}</p>
              </td>
              {CHANNELS.map((channel) => (
                <td key={channel} className="px-2 py-2.5 text-center">
                  <span className={cn("mx-auto grid h-7 w-7 place-items-center rounded-full transition-transform duration-200 group-hover:scale-110", rule.channels[channel] ? "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok" : "text-fg-3/50")} title={`${CHANNEL_LABELS[channel]}: ${rule.channels[channel] ? "activo" : "apagado"}`}>
                    {rule.channels[channel] ? <CheckCircle2 size={16} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2.5 text-fg-2">{rule.recipients}</td>
              <td className="px-3 py-2.5 text-[12.5px] text-fg-3">
                <span className="flex items-center gap-1">
                  {timing(rule.timing)}
                  {rule.condition !== "always" && <InfoTip label="Condición">{data.options.conditions.find((option) => option.value === rule.condition)?.label}</InfoTip>}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right">{data.can_manage && <RuleEditor rule={rule} options={data.options} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NotificationLog({ data }: { data: NotificationsOverview }) {
  const columns: Column<NotificationMessage>[] = [
    {
      id: "event",
      header: "Aviso",
      mobile: "title",
      cell: (message) => (
        <div className="min-w-0 max-w-[340px]">
          <p className="truncate text-[13.5px] font-semibold" title={message.subject}>
            {message.subject}
          </p>
          <p className="text-[11.5px] text-fg-3">
            <span className="font-mono">{message.code}</span> · {message.event_label}
          </p>
        </div>
      ),
    },
    { id: "channel", header: "Canal", cell: (message) => <ChannelChips channels={[message.channel]} /> },
    { id: "to", header: "Para", cell: (message) => <span className="text-[13px]">{message.to}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (message) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={STATUS[message.status].tone}>{STATUS[message.status].label}</Badge>
          {message.error && (
            <span className="max-w-[240px] text-[11.5px] text-bad" title={message.error}>
              {message.retries} {message.retries === 1 ? "reintento" : "reintentos"} · {message.permanent ? "error permanente" : "error temporal"}
            </span>
          )}
        </span>
      ),
    },
    { id: "at", header: "Fecha", wideOnly: true, cell: (message) => <span className="text-[12.5px] text-fg-3">{formatDateTime(message.at, false)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (message) =>
        data.can_manage && message.status === "fallido" ? (
          <RowActions>
            {message.permanent ? (
              <RowIcon tone="neutral" label="Reintentar" icon={<RefreshCw size={15} />} disabledHint="Error permanente: reintentar no lo resuelve. Corrige el destinatario." />
            ) : (
              <PanelAction<AdminActionState> label="Reintentar" variant="ghost" size="sm" formId={`notif-retry-${message.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reintentar envío" icon={<RefreshCw size={15} />} onClick={open} />} title="Reintentar envío" description={message.error ?? undefined} submitLabel="Reintentar" action={retryNotification} initial={ADMIN_INITIAL}>
                {() => <input type="hidden" name="code" value={message.code} />}
              </PanelAction>
            )}
            {message.can_fallback && (
              <PanelAction<AdminActionState> label="Reenviar por correo" variant="ghost" size="sm" formId={`notif-fallback-${message.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reenviar por correo" icon={<Mail size={15} />} onClick={open} />} title="Reenviar por correo" description="Enviamos el mismo aviso al correo del destinatario. El envío original queda registrado como fallido." submitLabel="Reenviar" action={fallbackNotification} initial={ADMIN_INITIAL}>
                {() => <input type="hidden" name="code" value={message.code} />}
              </PanelAction>
            )}
          </RowActions>
        ) : null,
    },
  ];
  const metrics: MetricFilter<NotificationMessage>[] = [
    { id: "sent", label: "Enviados", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (message) => message.status === "enviado" },
    { id: "failed", label: "Fallidos", tone: "bad", icon: <XCircle size={19} />, matches: (message) => message.status === "fallido" },
    { id: "queued", label: "En cola", tone: "sun", icon: <Clock size={19} />, matches: (message) => message.status === "pendiente" },
  ];
  const filters: FilterConfig<NotificationMessage>[] = [
    { id: "channel", label: "Canal", options: data.options.channels, value: (message) => message.channel },
    { id: "event", label: "Evento", options: [...new Map(data.messages.map((message) => [message.event, message.event_label])).entries()].map(([value, label]) => ({ value, label })), value: (message) => message.event },
  ];
  const sorts: SortOption<NotificationMessage>[] = [{ id: "at", label: "Fecha", type: "date", value: (message) => message.at }];
  return <DataTable screen="admin-notificaciones" rows={data.messages} columns={columns} getKey={(message) => message.code} entityLabel="envíos" searchText={(message) => `${message.code} ${message.subject} ${message.to} ${message.event_label}`} searchPlaceholder="Buscar envío, destinatario o asunto" metrics={metrics} filters={filters} sorts={sorts} />;
}
