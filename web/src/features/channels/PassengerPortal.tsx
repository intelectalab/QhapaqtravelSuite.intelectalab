"use client";

import { AlertCircle, BellRing, CheckCheck, Eye, Forward, Mail, MessageCircle, MessageSquareHeart, MessageSquareReply, Phone, Send, Smartphone } from "lucide-react";
import { markFeedback, replyFeedback } from "@/app/(backoffice)/canales/portal-pasajero/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { Tabs } from "@/components/ui/Tabs";
import { TextArea } from "@/components/ui/TextArea";
import { TintTile } from "@/components/ui/Tinted";
import { channelStatus, FEEDBACK_TYPES, MESSAGE_CHANNELS, type PassengerPortalOverview, type PaxFeedback, type PaxMessage } from "@/lib/channels";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";
import { ChannelBadge, DetailPanel, PanelSection, Stars, TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

const TYPE_TONES: Record<string, Tone> = { comentario: "t1", sugerencia: "violet", felicitacion: "ok", reclamo: "bad", incidencia: "warn" };

const CHANNEL_ICONS: Record<string, typeof Mail> = { email: Mail, whatsapp: MessageCircle, portal: Eye, push: Smartphone };

export function PassengerTiles({ kpis }: { kpis: PassengerPortalOverview["kpis"] }) {
  return (
    <TileGrid>
      <TintTile icon={Send} tone="t1" label="Mensajes enviados" value={kpis.sent} note={`${kpis.scheduled} programados`} />
      <TintTile icon={CheckCheck} tone="t4" label="Tasa de lectura" value={kpis.read_pct !== null ? `${kpis.read_pct} %` : "—"} note={`${kpis.read} leídos`} />
      <TintTile icon={MessageSquareHeart} tone="violet" label="Comentarios nuevos" value={`${kpis.feedback_new} de ${kpis.feedback_total}`} note={kpis.rating !== null ? `Calificación media ${kpis.rating}` : "Sin calificaciones"} />
      <TintTile icon={AlertCircle} tone="bad" label="Envíos fallidos" value={kpis.failed} note={kpis.failed > 0 ? "Revisa el contacto del pasajero" : "Todo entregado"} />
    </TileGrid>
  );
}

function ReplyAction({ feedback }: { feedback: PaxFeedback }) {
  return (
    <PanelAction<StepResult>
      label="Responder"
      formId={`fb-${feedback.code}`}
      title={feedback.reply ? "Editar respuesta" : "Responder al pasajero"}
      description={`${feedback.passenger} la verá en su portal y por correo.`}
      submitLabel="Enviar respuesta"
      action={replyFeedback}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label="Responder" icon={<MessageSquareReply size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={feedback.code} />
          <blockquote className="rounded-tile border-l-2 border-accent bg-surface-2 px-3 py-2 text-[13px] text-fg-2">{feedback.text}</blockquote>
          <TextArea label="Respuesta" name="text" rows={5} required minLength={5} maxLength={1000} defaultValue={feedback.reply ?? undefined} />
        </>
      )}
    </PanelAction>
  );
}

function MarkAction({ feedback, status }: { feedback: PaxFeedback; status: "leido" | "derivado" }) {
  const read = status === "leido";
  return (
    <PanelAction<StepResult>
      label={read ? "Marcar leído" : "Derivar"}
      formId={`fb-${feedback.code}-${status}`}
      title={read ? "Marcar como leído" : "Derivar a operaciones"}
      description={read ? "Queda registrado que el equipo lo revisó." : "Operaciones lo atiende como incidencia del viaje."}
      submitLabel={read ? "Marcar leído" : "Derivar"}
      action={markFeedback}
      initial={initial}
      trigger={(open) => <RowIcon tone={read ? "view" : "neutral"} label={read ? "Marcar leído" : "Derivar"} icon={read ? <Eye size={15} /> : <Forward size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={feedback.code} />
          <input type="hidden" name="status" value={status} />
        </>
      )}
    </PanelAction>
  );
}

function FeedbackBoard({ rows, canReply }: { rows: PaxFeedback[]; canReply: boolean }) {
  if (rows.length === 0) return <EmptyState icon={<MessageSquareHeart size={22} />} title="Sin comentarios" description="Lo que escriban los pasajeros desde su portal aparece aquí." />;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((feedback, index) => (
        <li key={feedback.code} style={{ ...toneStyle(TYPE_TONES[feedback.type] ?? "t1"), animationDelay: `${index * 70}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-2.5 rounded-tile border border-line border-l-[3px] border-l-[var(--tint)] bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <span>
              <span className="text-[12px] font-semibold text-[var(--tint)]">{FEEDBACK_TYPES[feedback.type] ?? feedback.type}</span>
              <b className="block text-[14px] font-semibold">{feedback.passenger}</b>
              <span className="text-[12px] text-fg-3">{feedback.reservation_title} · {formatDateTime(feedback.created_at)}</span>
            </span>
            <ChannelBadge status={feedback.status} />
          </div>
          <p className="text-[13px] text-fg-2">{feedback.text}</p>
          {feedback.service && <p className="text-[12px] text-fg-3">Sobre: {feedback.service}</p>}
          {feedback.rating !== null && <Stars value={feedback.rating} size={13} />}
          {feedback.reply && (
            <p className="rounded-lg bg-accent/5 px-3 py-2 text-[12.5px]">
              <b className="font-semibold">{feedback.replied_by ?? "Agencia"}:</b> {feedback.reply}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-wrap gap-3 text-[12px] text-fg-3">
              {feedback.email && <span className="flex items-center gap-1"><Mail size={12} />{feedback.email}</span>}
              {feedback.phone && <span className="flex items-center gap-1"><Phone size={12} />{feedback.phone}</span>}
            </span>
            {canReply && (
              <RowActions>
                <ReplyAction feedback={feedback} />
                {feedback.status === "nuevo" && <MarkAction feedback={feedback} status="leido" />}
                {feedback.status !== "respondido" && feedback.status !== "derivado" && <MarkAction feedback={feedback} status="derivado" />}
              </RowActions>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function MessageDetail({ message }: { message: PaxMessage }) {
  return (
    <DetailPanel label="Ver mensaje" title={message.subject ?? "Mensaje"} description={`${message.code} · ${MESSAGE_CHANNELS[message.channel] ?? message.channel}`}>
      <ChannelBadge status={message.status} />
      <p className="whitespace-pre-line rounded-tile border border-line bg-surface-2/50 p-3.5 text-[13px] leading-relaxed">{message.body ?? "Sin contenido."}</p>
      <PanelSection title="Entrega">
        <FieldList
          fields={[
            { label: "Para", value: message.recipient },
            { label: "Reserva", value: message.reservation_title ?? "—" },
            { label: "Plantilla", value: message.template ?? (message.origin === "auto" ? "Automático" : "Manual") },
            { label: "Programado", value: message.scheduled_at ? formatDateTime(message.scheduled_at) : "—" },
            { label: "Enviado", value: message.sent_at ? formatDateTime(message.sent_at) : "—" },
            { label: "Leído", value: message.read_at ? formatDateTime(message.read_at) : "—" },
          ]}
        />
      </PanelSection>
      {message.error && (
        <PanelSection title="Error">
          <p className="text-[13px] text-bad">{message.error}</p>
        </PanelSection>
      )}
    </DetailPanel>
  );
}

function MessagesTable({ rows }: { rows: PaxMessage[] }) {
  const columns: Column<PaxMessage>[] = [
    {
      id: "subject",
      header: "Mensaje",
      mobile: "title",
      cell: (row) => {
        const Icon = CHANNEL_ICONS[row.channel] ?? Mail;
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-accent/10 text-accent"><Icon size={15} /></span>
            <span className="min-w-0">
              <b className="block truncate text-[13.5px] font-semibold">{row.subject ?? row.body?.slice(0, 60) ?? "Mensaje"}</b>
              <span className="text-[12px] text-fg-3">{row.recipient}</span>
            </span>
          </span>
        );
      },
    },
    { id: "reservation", header: "Reserva", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.reservation_title ?? "—"}</span> },
    { id: "when", header: "Fecha", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDateTime(row.sent_at ?? row.scheduled_at ?? "")}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    { id: "actions", header: "", cell: (row) => <RowActions><MessageDetail message={row} /></RowActions> },
  ];
  const metrics: MetricFilter<PaxMessage>[] = [
    { id: "scheduled", label: "Programados", tone: "info", icon: <BellRing size={19} />, matches: (row) => row.status === "programado" },
    { id: "read", label: "Leídos", tone: "ok", icon: <CheckCheck size={19} />, matches: (row) => row.status === "leido" },
    { id: "failed", label: "Fallidos", tone: "bad", icon: <AlertCircle size={19} />, matches: (row) => row.status === "fallido" },
  ];
  const filters: FilterConfig<PaxMessage>[] = [
    { id: "channel", label: "Canal", options: Object.entries(MESSAGE_CHANNELS).map(([value, label]) => ({ value, label })), value: (row) => row.channel },
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: channelStatus(value).label })), value: (row) => row.status },
    { id: "reservation", label: "Reserva", options: [...new Map(rows.filter((row) => row.reservation).map((row) => [row.reservation as string, row.reservation_title ?? row.reservation ?? ""]))].map(([value, label]) => ({ value, label })), value: (row) => row.reservation ?? "" },
  ];
  const sorts: SortOption<PaxMessage>[] = [{ id: "date", label: "Fecha", type: "date", value: (row) => row.sent_at ?? row.scheduled_at }];
  return <DataTable screen="canales-portal-pasajero-mensajes" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="mensajes" searchText={(row) => `${row.subject ?? ""} ${row.recipient} ${row.reservation ?? ""} ${row.reservation_title ?? ""}`} searchPlaceholder="Buscar asunto, destinatario o reserva" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin mensajes" />;
}

export function PassengerWorkspace({ overview }: { overview: PassengerPortalOverview }) {
  return (
    <Card padded={false}>
      <Tabs
        tabs={[
          { id: "feedback", label: "Comentarios", count: overview.feedback.length, content: <FeedbackBoard rows={overview.feedback} canReply={overview.can_reply} /> },
          { id: "messages", label: "Mensajes enviados", count: overview.messages.length, content: <MessagesTable rows={overview.messages} /> },
        ]}
      />
    </Card>
  );
}
