"use client";

import { CheckCheck, Code2, ExternalLink, Eye, Gauge, Inbox, KeyRound, LayoutTemplate, Link2, MessageSquareReply, MessagesSquare, PlugZap, Settings2, Star, TriangleAlert } from "lucide-react";
import { markExternalPublished, replyExternalReview, saveReviewWidget } from "@/app/(backoffice)/canales/resenas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldList } from "@/components/ui/Details";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { channelStatus, type ExternalReview, type ExternalReviewsOverview, type ReviewSource, type ReviewWidgetSettings } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { avatarTone, toneStyle } from "@/lib/tone";
import { ChannelBadge, CodeSnippet, DetailPanel, PanelSection, Stars, TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

export function ExternalTiles({ overview }: { overview: ExternalReviewsOverview }) {
  const { kpis, sources } = overview;
  const answered = overview.items.filter((review) => review.status === "pendiente_publicar" || review.status === "publicada").length;
  const best = sources.filter((source) => source.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  return (
    <TileGrid>
      <TintTile icon={Star} tone="sun" label="Calificación ponderada" value={kpis.average !== null ? <span className="flex items-center gap-2">{kpis.average.toFixed(2)} <Stars value={kpis.average} size={13} /></span> : "—"} note={best ? `Mejor en ${best.label}` : undefined} info={<p>Promedio de las plataformas conectadas, pesado por cuántas reseñas tiene cada una.</p>} />
      <TintTile icon={MessagesSquare} tone="t1" label="Reseñas publicadas" value={formatNumber(kpis.total)} note="En las plataformas conectadas" info={<p>Total que informa cada plataforma en su última sincronización. La bandeja trae las más recientes para responderlas.</p>} />
      <TintTile icon={Gauge} tone="violet" label="Tasa de respuesta" value={kpis.inbox > 0 ? formatPercent((answered / kpis.inbox) * 100, 0) : "—"} note="Con respuesta guardada o publicada" info={<p>Reseñas de la bandeja que ya tienen respuesta: {formatNumber(answered)} de {formatNumber(kpis.inbox)}.</p>} />
      <TintTile icon={PlugZap} tone="ok" label="Plataformas conectadas" value={`${kpis.connected} de ${sources.length}`} note="Sincronizan cada día" info={<p>Las credenciales de cada plataforma se cargan y prueban en la consola de la plataforma; aquí se ve su estado.</p>} />
    </TileGrid>
  );
}

export function ConnectorsGrid({ sources }: { sources: ReviewSource[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-[color-mix(in_srgb,var(--tint)_18%,transparent)] pt-2.5 text-[12px]">
              <dt className="text-fg-3">Credencial</dt>
              <dd className="flex items-center gap-1 font-mono text-fg-2">{source.key_last4 ? <><KeyRound size={12} className="text-fg-3" />•••• {source.key_last4}</> : "—"}</dd>
              <dt className="text-fg-3">Alcances</dt>
              <dd className="flex flex-wrap gap-1">{source.scopes.length ? source.scopes.map((scope) => <span key={scope} className="rounded bg-surface-2 px-1.5 font-mono text-[11px] text-fg-2">{scope}</span>) : <span className="text-fg-3">—</span>}</dd>
              <dt className="text-fg-3">Conectó</dt>
              <dd className="truncate text-fg-2">{source.connected_by ? `${source.connected_by}${source.connected_at ? ` · ${formatDate(source.connected_at)}` : ""}` : "—"}</dd>
            </dl>
            <p className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px]">
              <span className={cn("rounded-md px-2 py-0.5", source.can_reply ? "bg-ok/10 text-ok" : "bg-surface-2 text-fg-3")}>{source.can_reply ? "Respuesta por API" : "Respuesta manual"}</span>
              {source.invites && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-fg-2">Invitaciones</span>}
            </p>
          </article>
        );
      })}
    </div>
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
          {overview.can_reply && row.status !== "publicada" && <ReplyAction review={row} />}
          {overview.can_reply && (row.status === "pendiente_publicar" || (row.status === "no_admite" && Boolean(row.reply))) && <PublishedAction review={row} />}
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

const LAYOUTS = [
  { value: "lista", label: "Lista" },
  { value: "cuadricula", label: "Cuadrícula" },
];

function widgetCode(widget: NonNullable<ExternalReviewsOverview["widget"]>): string {
  const { settings } = widget;
  return `<script type="module" src="${widget.cdn ?? ""}/kipucontrol-widget.js" async></script>\n<kipucontrol-reviews key="${widget.public_key}" tenant="${widget.tenant_slug}" sources="${settings.sources.join(",")}" min-rating="${settings.min_rating}" count="${settings.count}" layout="${settings.layout}"></kipucontrol-reviews>`;
}

function ReviewWidgetAction({ overview, settings }: { overview: ExternalReviewsOverview; settings: ReviewWidgetSettings }) {
  const connected = overview.sources.filter((source) => source.status === "conectado");
  return (
    <PanelAction<StepResult>
      label="Configurar"
      icon={<Settings2 size={16} />}
      size="sm"
      formId="review-widget"
      title="Configurar el widget de reseñas"
      description="Qué reseñas se muestran en tu sitio. Las páginas que ya lo usan toman los cambios al recargar."
      submitLabel="Guardar"
      action={saveReviewWidget}
      initial={initial}
    >
      {() => (
        <>
          <ChipToggleGroup label="Plataformas" name="sources" options={connected.map((source) => ({ value: source.provider, label: source.label }))} defaultValue={settings.sources} hint="Solo plataformas conectadas." />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Desde" name="min_rating" options={[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: value === 1 ? "1 estrella" : `${value} estrellas` }))} defaultValue={String(settings.min_rating)} />
            <TextField label="Cantidad" name="count" type="number" min={1} max={12} required defaultValue={settings.count} />
          </div>
          <ChoiceGroup label="Diseño" name="layout" options={LAYOUTS} defaultValue={settings.layout} />
        </>
      )}
    </PanelAction>
  );
}

export function ReviewWidgetSection({ overview }: { overview: ExternalReviewsOverview }) {
  const widget = overview.widget;
  if (!widget) return <EmptyState icon={<LayoutTemplate size={22} />} title="El widget no está configurado" description="Activa la integración web de la agencia para obtener la clave pública." />;
  const { settings } = widget;
  const labels = Object.fromEntries(overview.sources.map((source) => [source.provider, source.label]));
  const shown = overview.items
    .filter((review) => settings.sources.includes(review.provider) && review.rating >= settings.min_rating)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, settings.count);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FieldList
          fields={[
            { label: "Plataformas", value: settings.sources.map((provider) => labels[provider] ?? provider).join(", ") || "Ninguna" },
            { label: "Desde", value: <Stars value={settings.min_rating} size={12} /> },
            { label: "Cantidad", value: settings.count },
            { label: "Diseño", value: LAYOUTS.find((layout) => layout.value === settings.layout)?.label ?? settings.layout },
          ]}
        />
        {overview.can_configure && <ReviewWidgetAction overview={overview} settings={settings} />}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Code2 size={15} className="text-fg-3" /> Código para el sitio</p>
          <CodeSnippet code={widgetCode(widget)} />
          <p className="text-[12px] text-fg-3">Cada reseña enlaza a su original con la atribución de la plataforma. El texto no se edita.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Eye size={15} className="text-fg-3" /> Vista previa · {shown.length} de {settings.count}</p>
          {shown.length === 0 ? (
            <p className="rounded-tile border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Ninguna reseña de la bandeja cumple estos filtros.</p>
          ) : (
            <ul className={cn("grid gap-2.5", settings.layout === "cuadricula" && "sm:grid-cols-2")}>
              {shown.map((review, index) => (
                <li key={review.id} style={{ animationDelay: `${index * 60}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-line bg-surface px-3.5 py-3">
                  <span className="flex items-center justify-between gap-2">
                    <Stars value={review.rating} size={12} />
                    <span className="text-[11.5px] text-fg-3">{review.source}</span>
                  </span>
                  {review.title && <b className="mt-1.5 block text-[13px] font-semibold">{review.title}</b>}
                  {review.body && <span className="mt-0.5 line-clamp-3 block text-[12.5px] text-fg-2">{review.body}</span>}
                  <span className="mt-1.5 block text-[11.5px] text-fg-3">{review.author} · {formatDate(review.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExternalReviewsWorkspace({ overview, section }: { overview: ExternalReviewsOverview; section: "inbox" | "connectors" | "widget" }) {
  if (section === "connectors") return <ConnectorsGrid sources={overview.sources} />;
  if (section === "widget") return <ReviewWidgetSection overview={overview} />;
  return <ExternalInbox overview={overview} />;
}
