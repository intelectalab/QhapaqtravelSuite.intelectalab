"use client";

import { BadgeCheck, CircleCheck, Clock3, EyeOff, Inbox, MessageSquareReply, Send, Star, ThumbsUp, TriangleAlert, XCircle } from "lucide-react";
import { moderateReview, replyReview, reviewRequestAction } from "@/app/(backoffice)/canales/resenas-propias/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { Tabs } from "@/components/ui/Tabs";
import { TextArea } from "@/components/ui/TextArea";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { channelStatus, type OwnReview, type OwnReviewsOverview, type ReviewRequest } from "@/lib/channels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ChannelBadge, DetailPanel, PanelSection, Stars, TileGrid, Timeline, UsageBar } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

const ACTIONS = {
  publicar: { label: "Publicar", icon: <CircleCheck size={15} />, tone: "view" as const, hint: "Se muestra en el sitio y en el widget con el sello de viaje verificado." },
  ocultar: { label: "Ocultar", icon: <EyeOff size={15} />, tone: "neutral" as const, hint: "Deja de mostrarse; se conserva para los reportes." },
  rechazar: { label: "Rechazar", icon: <XCircle size={15} />, tone: "delete" as const, hint: "No se publica. La nota nunca es motivo de rechazo." },
};

const LOG_LABELS: Record<string, string> = { crear: "Recibida", publicar: "Publicada", ocultar: "Ocultada", rechazar: "Rechazada", responder: "Respondida", editar_respuesta: "Respuesta editada", autopublicar: "Publicada automáticamente" };

export function OwnReviewTiles({ kpis }: { kpis: OwnReviewsOverview["kpis"] }) {
  return (
    <TileGrid>
      <TintTile icon={Star} tone="sun" label="Calificación promedio" value={kpis.average !== null ? <span className="flex items-center gap-2">{kpis.average.toFixed(1)} <Stars value={kpis.average} size={13} /></span> : "—"} note="De las reseñas publicadas" />
      <TintTile icon={BadgeCheck} tone="t1" label="Publicadas" value={`${kpis.published} de ${kpis.received}`} note="Todas de viajes verificados" />
      <TintTile icon={ThumbsUp} tone="t4" label="Recomiendan" value={kpis.recommend_pct !== null ? `${kpis.recommend_pct} %` : "—"} note="Calificaron con 4 o 5 estrellas" />
      <TintTile icon={Inbox} tone="violet" label="Por moderar" value={kpis.pending} note={kpis.flagged > 0 ? `${kpis.flagged} con alertas` : "Sin alertas"} />
    </TileGrid>
  );
}

export function OwnReviewSummary({ overview }: { overview: OwnReviewsOverview }) {
  const total = Math.max(1, overview.distribution.reduce((sum, item) => sum + item.count, 0));
  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-3">
      <Card>
        <TintCardTitle icon={Star} title="Distribución" tone="sun" />
        <ul className="flex flex-col gap-2">
          {overview.distribution.map((item) => (
            <li key={item.stars} className="group grid grid-cols-[52px_1fr_28px] items-center gap-2.5 text-[12.5px]" title={`${item.count} reseñas con ${item.stars} estrellas`}>
              <span className="flex items-center gap-1 font-semibold">{item.stars} <Star size={12} className="fill-[var(--t2)] text-[var(--t2)]" /></span>
              <UsageBar pct={(item.count / total) * 100} tone={item.stars >= 4 ? "ok" : item.stars === 3 ? "warn" : "bad"} />
              <span className="text-right font-mono text-fg-3 group-hover:text-fg">{item.count}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <TintCardTitle icon={BadgeCheck} title="Por producto" tone="t1" />
        <ul className="flex flex-col gap-2.5">
          {overview.by_product.map((product) => (
            <li key={product.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2">
              <span className="min-w-0 truncate text-[13px] font-medium">{product.name}</span>
              <span className="flex flex-none items-center gap-1.5 text-[12px] text-fg-3"><Stars value={product.average} size={11} /> ({product.count})</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <TintCardTitle icon={ThumbsUp} title="Por aspecto" tone="t4" />
        <ul className="flex flex-col gap-2">
          {overview.subratings.map((item) => (
            <li key={item.key} className="grid grid-cols-[110px_1fr_34px] items-center gap-2.5 text-[12.5px]" title={item.count ? `${item.count} calificaciones` : "Sin calificaciones"}>
              <span>{item.label}</span>
              <UsageBar pct={item.average ? (item.average / 5) * 100 : 0} tone="t4" />
              <span className="text-right font-mono text-fg-3">{item.average?.toFixed(1) ?? "—"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ModerateAction({ review, action }: { review: OwnReview; action: keyof typeof ACTIONS }) {
  const meta = ACTIONS[action];
  return (
    <PanelAction<StepResult>
      label={meta.label}
      formId={`review-${review.code}-${action}`}
      title={`${meta.label} reseña`}
      description={`${review.author} · ${review.product.name}. ${meta.hint}`}
      submitLabel={meta.label}
      action={moderateReview}
      initial={initial}
      trigger={(open) => <RowIcon tone={meta.tone} label={meta.label} icon={meta.icon} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={review.code} />
          <input type="hidden" name="lock_version" value={review.lock_version} />
          <input type="hidden" name="action" value={action} />
          {action === "publicar" ? (
            <p className="text-[13px] text-fg-2">{review.moderation_reason ? `Tiene una alerta: ${review.moderation_reason}. Confirma que puede publicarse.` : "El viajero autorizó su publicación."}</p>
          ) : (
            <TextArea label="Motivo" name="reason" rows={3} required maxLength={300} />
          )}
        </>
      )}
    </PanelAction>
  );
}

function ReplyAction({ review }: { review: OwnReview }) {
  return (
    <PanelAction<StepResult>
      label="Responder"
      formId={`review-${review.code}-reply`}
      title={review.reply ? "Editar respuesta" : "Responder"}
      description="La respuesta es pública y llega al viajero en su portal. No incluyas correos ni teléfonos."
      submitLabel="Guardar respuesta"
      action={replyReview}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label={review.reply ? "Editar respuesta" : "Responder"} icon={<MessageSquareReply size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={review.code} />
          <input type="hidden" name="lock_version" value={review.lock_version} />
          <blockquote className="rounded-tile border-l-2 border-accent bg-surface-2 px-3 py-2 text-[13px] text-fg-2">{review.body}</blockquote>
          <TextArea label="Respuesta" name="text" rows={5} required minLength={5} maxLength={1000} defaultValue={review.reply ?? undefined} />
        </>
      )}
    </PanelAction>
  );
}

function ReviewDetail({ review }: { review: OwnReview }) {
  return (
    <DetailPanel label="Ver reseña" title={review.title} description={`${review.code} · ${review.author}${review.country ? `, ${review.country}` : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.stars} />
        <ChannelBadge status={review.status} />
        {review.verified && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok"><BadgeCheck size={13} /> Viaje verificado</span>}
      </div>
      <p className="text-[13.5px] leading-relaxed text-fg-2">{review.body}</p>
      {review.subratings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.subratings.map((item) => (
            <span key={item.key} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[12px]">{item.label} <b>{item.value}</b></span>
          ))}
        </div>
      )}
      {review.reply && (
        <PanelSection title="Respuesta de la agencia" aside={review.replied_at ? formatDateTime(review.replied_at) : undefined}>
          <p className="rounded-tile bg-accent/5 px-3 py-2 text-[13px]">{review.reply}</p>
        </PanelSection>
      )}
      <PanelSection title="Viaje">
        <FieldList
          fields={[
            { label: "Producto", value: review.product.name },
            { label: "Reserva", value: review.reservation },
            { label: "Fecha", value: formatDate(review.travel_date) },
            { label: "Origen", value: review.source },
            { label: "Idioma", value: review.lang.toUpperCase() },
          ]}
        />
      </PanelSection>
      <PanelSection title="Moderación">
        <Timeline items={review.log.map((entry, index) => ({ key: `${entry.at}-${index}`, title: LOG_LABELS[entry.action] ?? entry.action, meta: `${entry.user} · ${formatDateTime(entry.at)}`, note: entry.note ?? undefined }))} />
      </PanelSection>
    </DetailPanel>
  );
}

function ReviewActions({ review, canModerate }: { review: OwnReview; canModerate: boolean }) {
  return (
    <RowActions>
      <ReviewDetail review={review} />
      {canModerate ? (
        <>
          <ReplyAction review={review} />
          {review.status !== "publicada" && <ModerateAction review={review} action="publicar" />}
          {review.status !== "oculta" && <ModerateAction review={review} action="ocultar" />}
          {review.status !== "rechazada" && <ModerateAction review={review} action="rechazar" />}
        </>
      ) : (
        <RowIcon tone="edit" label="Responder" icon={<MessageSquareReply size={15} />} disabledHint="Solo lectura: moderan Gerencia y Administración" />
      )}
    </RowActions>
  );
}

function ModerationInbox({ rows, canModerate }: { rows: OwnReview[]; canModerate: boolean }) {
  if (rows.length === 0) return <EmptyState icon={<Inbox size={22} />} title="Nada por moderar" description="Las reseñas nuevas con alertas o sin publicar aparecen aquí." />;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((review, index) => (
        <li key={review.code} style={{ animationDelay: `${index * 70}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-2.5 rounded-tile border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <span>
              <b className="block text-[14px] font-semibold">{review.title}</b>
              <span className="text-[12px] text-fg-3">{review.author} · {review.product.name} · {formatDate(review.created_at)}</span>
            </span>
            <Stars value={review.stars} size={13} />
          </div>
          <p className="line-clamp-3 text-[13px] text-fg-2">{review.body}</p>
          {review.moderation_reason && (
            <p className="flex items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-2.5 py-1.5 text-[12px] font-medium text-warn">
              <TriangleAlert size={13} /> {review.moderation_reason}
            </p>
          )}
          <ReviewActions review={review} canModerate={canModerate} />
        </li>
      ))}
    </ul>
  );
}

function ReviewsTable({ rows, canModerate }: { rows: OwnReview[]; canModerate: boolean }) {
  const columns: Column<OwnReview>[] = [
    {
      id: "review",
      header: "Reseña",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[13.5px] font-semibold">{row.title}</b>
          <span className="text-[12px] text-fg-3">{row.author}{row.country ? ` · ${row.country}` : ""}</span>
        </span>
      ),
    },
    { id: "stars", header: "Calificación", cell: (row) => <Stars value={row.stars} size={13} /> },
    { id: "product", header: "Producto", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.product.name}</span> },
    { id: "date", header: "Recibida", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDate(row.created_at)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    { id: "actions", header: "", cell: (row) => <ReviewActions review={row} canModerate={canModerate} /> },
  ];
  const metrics: MetricFilter<OwnReview>[] = [
    { id: "published", label: "Publicadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "publicada" },
    { id: "pending", label: "Pendientes", tone: "warn", icon: <Clock3 size={19} />, matches: (row) => row.status === "pendiente" },
    { id: "replied", label: "Con respuesta", tone: "violet", icon: <MessageSquareReply size={19} />, matches: (row) => row.reply !== null },
    { id: "low", label: "3 estrellas o menos", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.stars <= 3 },
  ];
  const filters: FilterConfig<OwnReview>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: channelStatus(value).label })), value: (row) => row.status },
    { id: "stars", label: "Estrellas", options: [5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} estrellas` })), value: (row) => String(row.stars) },
    { id: "product", label: "Producto", options: [...new Map(rows.map((row) => [row.product.code, row.product.name]))].map(([value, label]) => ({ value, label })), value: (row) => row.product.code },
  ];
  const sorts: SortOption<OwnReview>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.created_at },
    { id: "stars", label: "Estrellas", type: "number", value: (row) => row.stars },
  ];
  return <DataTable screen="canales-resenas-propias" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="reseñas" searchText={(row) => `${row.title} ${row.body} ${row.author} ${row.product.name} ${row.reservation}`} searchPlaceholder="Buscar en reseñas" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin reseñas" />;
}

function RequestAction({ request, action }: { request: ReviewRequest; action: "enviar" | "cancelar" }) {
  const send = action === "enviar";
  return (
    <PanelAction<StepResult>
      label={send ? "Enviar ahora" : "Cancelar"}
      formId={`request-${request.code}-${action}`}
      title={send ? (request.status === "programada" ? "Enviar invitación ahora" : "Reenviar invitación") : "Cancelar invitación"}
      description={send ? `Se envía a ${request.to} y vence en 30 días.` : `${request.client} no recibirá la invitación programada.`}
      submitLabel={send ? "Enviar" : "Cancelar invitación"}
      action={reviewRequestAction}
      initial={initial}
      trigger={(open) => <RowIcon tone={send ? "view" : "delete"} label={send ? "Enviar ahora" : "Cancelar"} icon={send ? <Send size={15} /> : <XCircle size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={request.code} />
          <input type="hidden" name="action" value={action} />
        </>
      )}
    </PanelAction>
  );
}

function RequestsTable({ rows, canModerate }: { rows: ReviewRequest[]; canModerate: boolean }) {
  const columns: Column<ReviewRequest>[] = [
    {
      id: "client",
      header: "Viajero",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.client}</b>
          <span className="text-[12px] text-fg-3">{row.reservation} · {row.to}</span>
        </span>
      ),
    },
    { id: "channel", header: "Canal", cell: (row) => <span className="text-[13px]">{row.channel === "email" ? "Correo" : "WhatsApp"} · {row.lang.toUpperCase()}</span> },
    { id: "when", header: "Envío", cell: (row) => <span className="text-[12.5px] text-fg-2">{row.sent_at ? `Enviada ${formatDateTime(row.sent_at)}` : row.scheduled_at ? `Programada ${formatDateTime(row.scheduled_at)}` : "—"}</span> },
    { id: "reviews", header: "Reseñas", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.reviews}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {canModerate && ["programada", "enviada", "vencida"].includes(row.status) && <RequestAction request={row} action="enviar" />}
          {canModerate && row.status === "programada" && <RequestAction request={row} action="cancelar" />}
        </RowActions>
      ),
    },
  ];
  return <DataTable screen="canales-resenas-solicitudes" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="solicitudes" searchText={(row) => `${row.client} ${row.reservation} ${row.to}`} searchPlaceholder="Buscar viajero o reserva" emptyTitle="Sin solicitudes" />;
}

export function OwnReviewsWorkspace({ overview }: { overview: OwnReviewsOverview }) {
  const pending = overview.items.filter((review) => review.status === "pendiente");
  return (
    <Card padded={false}>
      <Tabs
        initial={pending.length > 0 ? "inbox" : "all"}
        tabs={[
          { id: "inbox", label: "Por moderar", count: pending.length, content: <ModerationInbox rows={pending} canModerate={overview.can_moderate} /> },
          { id: "all", label: "Todas las reseñas", count: overview.items.length, content: <ReviewsTable rows={overview.items} canModerate={overview.can_moderate} /> },
          { id: "requests", label: "Invitaciones", count: overview.requests.length, content: <RequestsTable rows={overview.requests} canModerate={overview.can_moderate} /> },
        ]}
      />
    </Card>
  );
}
