"use client";

import { CheckCheck, ExternalLink, Inbox, Link2, MessageSquareReply, PlugZap, Star, TriangleAlert } from "lucide-react";
import { markExternalPublished, replyExternalReview } from "@/app/(backoffice)/canales/resenas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TintTile } from "@/components/ui/Tinted";
import { channelStatus, type ExternalReview, type ExternalReviewsOverview, type ReviewSource } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { avatarTone, toneStyle } from "@/lib/tone";
import { ChannelBadge, DetailPanel, PanelSection, Stars, TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

export function ExternalTiles({ kpis }: { kpis: ExternalReviewsOverview["kpis"] }) {
  return (
    <TileGrid>
      <TintTile icon={Star} tone="sun" label="Calificación ponderada" value={kpis.average !== null ? <span className="flex items-center gap-2">{kpis.average.toFixed(2)} <Stars value={kpis.average} size={13} /></span> : "—"} note={`${formatNumber(kpis.total)} reseñas en plataformas conectadas`} />
      <TintTile icon={PlugZap} tone="t1" label="Plataformas conectadas" value={kpis.connected} note="Sincronizan cada día" />
      <TintTile icon={Inbox} tone="violet" label="Sin responder" value={`${kpis.unanswered} de ${kpis.inbox}`} note="En la bandeja" />
      <TintTile icon={TriangleAlert} tone="bad" label="Críticas sin respuesta" value={kpis.critical} note="3 estrellas o menos" />
    </TileGrid>
  );
}

export function SourcesGrid({ sources }: { sources: ReviewSource[] }) {
  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map((source, index) => {
        const connected = source.status === "conectado";
        return (
          <article key={source.provider} style={{ ...toneStyle(connected ? avatarTone(source.provider) : "mute"), animationDelay: `${index * 60}ms` }} className="lift group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--tint)] text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{source.label.slice(0, 2)}</span>
                <span>
                  <b className="block text-[14px] font-semibold">{source.label}</b>
                  <span className="text-[12px] text-fg-3">{source.account ?? "Sin cuenta vinculada"}</span>
                </span>
              </span>
              <ChannelBadge status={source.status} />
            </div>
            {connected ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <span>
                  <span className="flex items-center gap-2 text-[22px] font-bold leading-none tracking-tight">{source.rating?.toFixed(1) ?? "—"} {source.rating !== null && <Stars value={source.rating} size={12} />}</span>
                  <span className="mt-1 block text-[12px] text-fg-3">{formatNumber(source.count)} reseñas · {source.inbox} en bandeja</span>
                </span>
                <span className="text-right text-[11.5px] text-fg-3">{source.last_sync_at ? `Sincronizó ${formatDateTime(source.last_sync_at, false)}` : "Sin sincronizar"}</span>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-fg-3">{source.status === "pendiente" ? "Permisos en revisión por la plataforma." : "Conéctala para traer sus reseñas a la bandeja."}</p>
            )}
            <p className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px]">
              <span className={cn("rounded-md px-2 py-0.5", source.can_reply ? "bg-ok/10 text-ok" : "bg-surface-2 text-fg-3")}>{source.can_reply ? "Respuesta por API" : "Respuesta manual"}</span>
              {source.invites && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-fg-2">Invitaciones</span>}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function ReplyAction({ review }: { review: ExternalReview }) {
  return (
    <PanelAction<StepResult>
      label="Responder"
      formId={`xrv-${review.id}`}
      title={review.reply ? "Editar respuesta" : "Responder reseña"}
      description={review.can_reply ? `Se publicará en ${review.source} al sincronizar.` : `${review.source} no admite respuestas por API: guárdala, cópiala en la plataforma y márcala como publicada.`}
      submitLabel="Guardar respuesta"
      action={replyExternalReview}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label={review.reply ? "Editar respuesta" : "Responder"} icon={<MessageSquareReply size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={review.id} />
          <blockquote className="rounded-tile border-l-2 border-accent bg-surface-2 px-3 py-2 text-[13px] text-fg-2">
            <Stars value={review.rating} size={12} className="mb-1" />
            {review.body}
          </blockquote>
          <TextArea label="Respuesta" name="text" rows={6} required minLength={5} maxLength={1500} defaultValue={review.reply ?? undefined} placeholder={`Gracias, ${review.author.split(" ")[0]}…`} />
        </>
      )}
    </PanelAction>
  );
}

function PublishedAction({ review }: { review: ExternalReview }) {
  return (
    <PanelAction<StepResult>
      label="Marcar publicada"
      formId={`xrv-pub-${review.id}`}
      title="Marcar respuesta como publicada"
      description={`Confirma que la respuesta ya se ve en ${review.source}.`}
      submitLabel="Marcar publicada"
      action={markExternalPublished}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Marcar publicada" icon={<CheckCheck size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="id" value={review.id} />}
    </PanelAction>
  );
}

function ReviewDetail({ review }: { review: ExternalReview }) {
  return (
    <DetailPanel label="Ver reseña" title={review.title ?? "Reseña sin título"} description={`${review.source} · ${review.author}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <ChannelBadge status={review.status} />
      </div>
      <p className="text-[13.5px] leading-relaxed text-fg-2">{review.body ?? "Sin texto."}</p>
      {review.reply && (
        <PanelSection title="Nuestra respuesta" aside={review.replied_by ? `${review.replied_by}${review.replied_at ? ` · ${formatDateTime(review.replied_at)}` : ""}` : undefined}>
          <p className="rounded-tile bg-accent/5 px-3 py-2 text-[13px]">{review.reply}</p>
        </PanelSection>
      )}
      <PanelSection title="Datos">
        <FieldList
          fields={[
            { label: "Fecha", value: formatDate(review.date) },
            { label: "Producto", value: review.product?.name ?? "General de la agencia" },
            { label: "Idioma", value: review.lang?.toUpperCase() ?? "—" },
            { label: "Referencia", value: review.code },
            {
              label: "Original",
              value: review.url ? (
                <a href={review.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">
                  Abrir <ExternalLink size={12} />
                </a>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </PanelSection>
    </DetailPanel>
  );
}

export function ExternalInbox({ overview }: { overview: ExternalReviewsOverview }) {
  const rows = overview.items;
  const columns: Column<ExternalReview>[] = [
    {
      id: "review",
      header: "Reseña",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[13.5px] font-semibold">{row.title ?? row.body?.slice(0, 60)}</b>
          <span className="text-[12px] text-fg-3">{row.author} · {formatDate(row.date)}</span>
        </span>
      ),
    },
    { id: "source", header: "Plataforma", cell: (row) => <span className="inline-flex items-center gap-1.5 text-[13px]"><Link2 size={13} className="text-fg-3" />{row.source}</span> },
    { id: "rating", header: "Calificación", cell: (row) => <Stars value={row.rating} size={13} /> },
    { id: "product", header: "Producto", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{row.product?.name ?? "General"}</span> },
    { id: "status", header: "Respuesta", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          <ReviewDetail review={row} />
          {overview.can_reply && row.status !== "no_admite" && <ReplyAction review={row} />}
          {overview.can_reply && row.status === "pendiente_publicar" && <PublishedAction review={row} />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ExternalReview>[] = [
    { id: "open", label: "Sin responder", tone: "warn", icon: <Inbox size={19} />, matches: (row) => row.status === "sin_responder" },
    { id: "critical", label: "Críticas", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.rating <= 3 },
    { id: "toPublish", label: "Por publicar", tone: "info", icon: <MessageSquareReply size={19} />, matches: (row) => row.status === "pendiente_publicar" },
    { id: "done", label: "Respondidas", tone: "ok", icon: <CheckCheck size={19} />, matches: (row) => row.status === "publicada" },
  ];
  const filters: FilterConfig<ExternalReview>[] = [
    { id: "source", label: "Plataforma", options: [...new Set(rows.map((row) => row.source))].map((value) => ({ value, label: value })), value: (row) => row.source },
    { id: "status", label: "Respuesta", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: channelStatus(value).label })), value: (row) => row.status },
    { id: "rating", label: "Estrellas", options: [5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} estrellas` })), value: (row) => String(row.rating) },
  ];
  const sorts: SortOption<ExternalReview>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.date },
    { id: "rating", label: "Calificación", type: "number", value: (row) => row.rating },
  ];
  return <DataTable screen="canales-resenas-externas" rows={rows} columns={columns} getKey={(row) => row.id} entityLabel="reseñas" searchText={(row) => `${row.author} ${row.title ?? ""} ${row.body ?? ""} ${row.source}`} searchPlaceholder="Buscar autor o texto" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin reseñas en la bandeja" />;
}
