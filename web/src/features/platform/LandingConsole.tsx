"use client";

import { Ban, BookOpenText, CheckCircle2, CircleSlash, Clock, ExternalLink, Eye, FilePen, Mail, MailCheck, MailX, MegaphoneOff, MessageSquareReply, MessagesSquare, MousePointerClick, Pause, Play, Plus, Send, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { changePopupStatus, changePostStatus, createPopup, createPost, deleteComment, deletePopup, deletePost, moderateComment, replyComment, updatePopup, updatePost } from "@/app/plataforma/(consola)/marketing-vitrina/landing-actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDateTime, formatNumber } from "@/lib/format";
import { type CommentsOverview, type ConsoleComment, type ConsolePopup, type ConsolePost, faqToText, type PopupsOverview, type PostsOverview, type Subscriber, type SubscribersOverview } from "@/lib/landing-content";
import type { Tone } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

const COMMENT_TONE: Record<ConsoleComment["status"], Tone> = { pendiente: "warn", aprobado: "ok", rechazado: "mute", spam: "bad" };

const POPUP_TONE: Record<ConsolePopup["status"], Tone> = { borrador: "mute", activo: "ok", pausado: "warn" };

const POST_TONE: Record<ConsolePost["status"], Tone> = { borrador: "warn", publicado: "ok", archivado: "mute" };

const SUBSCRIBER_TONE: Record<Subscriber["status"], Tone> = { pendiente: "warn", confirmado: "ok", baja: "mute" };

const percent = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`);

function StatusChoice({ name, options, label }: { name: string; options: { value: string; label: string }[]; label: string }) {
  const [value, setValue] = useState(options[0]?.value ?? "");
  return <SelectField label={label} name={name} options={options} value={value} onChange={setValue} />;
}

function CommentActions({ comment }: { comment: ConsoleComment }) {
  return (
    <RowActions>
      <RowIcon tone="view" label="Ver en el artículo" icon={<ExternalLink size={15} />} href={comment.post.href} />
      {comment.actions.length > 0 ? (
        <ConsoleAction id={`moderar-${comment.code}`} label="Moderar" icon={<ShieldAlert size={15} />} rowTone="edit" title={`Moderar ${comment.code}`} description={`${comment.name} · ${comment.post.title}`} submitLabel="Aplicar" action={moderateComment} fields={{ id: comment.id }}>
          <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg-2">{comment.body}</p>
          <StatusChoice label="Acción" name="status" options={comment.actions} />
        </ConsoleAction>
      ) : null}
      {comment.can_reply && (
        <ConsoleAction id={`responder-${comment.code}`} label="Responder" icon={<MessageSquareReply size={15} />} rowTone="neutral" title={`Responder a ${comment.name}`} description={comment.status === "pendiente" ? "Al responder, el comentario también se aprueba." : "La respuesta se publica con la marca «Equipo KipuControl»."} submitLabel="Publicar respuesta" action={replyComment} fields={{ id: comment.id }}>
          <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg-2">{comment.body}</p>
          <TextArea label="Respuesta" name="body" rows={5} required minLength={10} maxLength={1500} />
        </ConsoleAction>
      )}
      {(comment.staff || comment.status !== "aprobado") && (
        <ConsoleAction id={`eliminar-${comment.code}`} label="Eliminar" icon={<Trash2 size={15} />} rowTone="delete" title={`Eliminar ${comment.code}`} description="El comentario se borra de forma definitiva. La moderación queda en la auditoría." submitLabel="Eliminar" action={deleteComment} fields={{ id: comment.id }} />
      )}
    </RowActions>
  );
}

const commentColumns: Column<ConsoleComment>[] = [
  {
    id: "comment",
    header: "Comentario",
    mobile: "title",
    cell: (row) => (
      <div className="flex max-w-[460px] gap-3">
        <Avatar name={row.name} />
        <div className="min-w-0">
          <b className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
            {row.name}
            {row.staff && <Badge tone="t1">Equipo</Badge>}
            {row.reply_to && <span className="text-[11.5px] font-normal text-fg-3">responde a {row.reply_to.name}</span>}
          </b>
          <p className="mt-0.5 line-clamp-2 whitespace-normal text-[12.5px] text-fg-2">{row.body}</p>
          {row.email && <small className="block truncate text-[11.5px] text-fg-3">{row.email}</small>}
        </div>
      </div>
    ),
  },
  { id: "post", header: "Artículo", wideOnly: true, cell: (row) => <Link href={row.post.href} target="_blank" className="line-clamp-2 max-w-[220px] whitespace-normal text-[12.5px] text-fg-2 hover:text-accent">{row.post.title}</Link> },
  { id: "created", header: "Fecha", cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{formatDateTime(row.created_at)}</span> },
  { id: "useful", header: "Útil", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.useful}</span> },
  { id: "status", header: "Estado", mobile: "detail", cell: (row) => <span className="flex flex-col gap-0.5"><Badge tone={COMMENT_TONE[row.status]}>{row.status_label}</Badge>{row.moderator && <small className="text-[11px] text-fg-3">{row.moderator}</small>}</span> },
  { id: "actions", header: "", cell: (row) => <CommentActions comment={row} /> },
];

export function CommentsTable({ overview }: { overview: CommentsOverview }) {
  const metrics: MetricFilter<ConsoleComment>[] = [
    { id: "pending", label: "Por revisar", tone: overview.counts.pendiente > 0 ? "warn" : "ok", icon: <Clock size={19} />, info: <p>Comentarios en estado pendiente: el primero de cada correo entra así y espera moderación (LND-11).</p>, matches: (row) => row.status === "pendiente" },
    { id: "approved", label: "Publicados", tone: "ok", icon: <CheckCircle2 size={19} />, info: <p>Comentarios aprobados que se ven en el artículo. Un correo con un comentario aprobado publica los siguientes sin moderación.</p>, matches: (row) => row.status === "aprobado" },
    { id: "spam", label: "Spam", tone: "bad", icon: <Ban size={19} />, info: <p>Comentarios con 2 enlaces o más o marcados a mano como spam. El campo trampa descarta a los bots sin guardarlos.</p>, matches: (row) => row.status === "spam" },
    { id: "staff", label: "Respuestas del equipo", tone: "t1", icon: <MessagesSquare size={19} />, info: <p>Respuestas publicadas desde aquí con la marca «Equipo KipuControl». Tienen un solo nivel (LND-12).</p>, matches: (row) => row.staff },
  ];
  const filters: FilterConfig<ConsoleComment>[] = [{ id: "estado", label: "Estado", options: overview.statuses, value: (row) => row.status }];
  const sorts: SortOption<ConsoleComment>[] = [{ id: "created", label: "Fecha", type: "date", value: (row) => row.created_at }, { id: "useful", label: "Votos útiles", type: "number", value: (row) => row.useful }];
  return <DataTable screen="plataforma-landing-comentarios" rows={overview.items} columns={commentColumns} getKey={(row) => row.id} entityLabel="comentarios" searchText={(row) => `${row.code} ${row.name} ${row.email ?? ""} ${row.body} ${row.post.title}`} searchPlaceholder="Buscar persona, texto o artículo" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay comentarios en el blog" />;
}

function PopupFields({ options, popup }: { options: PopupsOverview["options"]; popup?: ConsolePopup }) {
  const [trigger, setTrigger] = useState(popup?.trigger ?? "salida");
  const [kind, setKind] = useState(popup?.kind ?? "prueba");
  return (
    <>
      <TextField label="Nombre interno" name="name" required maxLength={80} defaultValue={popup?.name} hint="Solo lo ve el equipo." />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Cuándo aparece" name="trigger" options={options.triggers} value={trigger} onChange={(value) => setTrigger(value as ConsolePopup["trigger"])} hint={trigger === "salida" ? "Solo en computadora: en móvil no se muestra." : undefined} />
        <SelectField label="Qué ofrece" name="kind" options={options.kinds} value={kind} onChange={(value) => setKind(value as ConsolePopup["kind"])} />
      </div>
      <ChipToggleGroup label="Páginas" name="pages" options={options.pages} defaultValue={popup?.pages ?? ["inicio"]} hint="Nunca aparece en el alta, la bienvenida ni el boletín." />
      <TextField label="Frecuencia en días" name="freq_days" type="number" min={1} max={90} required defaultValue={String(popup?.freq_days ?? 7)} hint="Cada visitante lo ve como máximo una vez en ese plazo." />
      <TextField label="Etiqueta" name="eyebrow" maxLength={40} defaultValue={popup?.eyebrow ?? ""} hint="Opcional, sobre el título." />
      <TextField label="Título" name="title" required maxLength={90} defaultValue={popup?.title} />
      <TextArea label="Texto" name="body" rows={3} required maxLength={280} defaultValue={popup?.body} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Texto del botón" name="cta_label" required maxLength={40} defaultValue={popup?.cta_label} />
        <TextField label="Lleva a" name="cta_href" maxLength={200} defaultValue={popup?.cta_href ?? ""} required={kind === "enlace"} hint={kind === "boletin" ? "No hace falta: suscribe al boletín." : "Ruta del sitio, por ejemplo /software/planes."} />
      </div>
    </>
  );
}

function PopupActions({ popup, options }: { popup: ConsolePopup; options: PopupsOverview["options"] }) {
  return (
    <RowActions>
      <ConsoleAction id={`popup-editar-${popup.code}`} label="Editar" icon={<FilePen size={15} />} rowTone="edit" title={`Editar ${popup.code}`} description={popup.name} submitLabel="Guardar" action={updatePopup} fields={{ code: popup.code }}>
        <PopupFields options={options} popup={popup} />
      </ConsoleAction>
      {popup.next.map((next) => (
        <ConsoleAction key={next.value} id={`popup-${next.value}-${popup.code}`} label={next.label} icon={next.value === "activo" ? <Play size={15} /> : <Pause size={15} />} rowTone="neutral" title={`${next.label} ${popup.code}`} description={next.value === "activo" ? "Empieza a mostrarse en las páginas elegidas, una vez por visita." : "Deja de mostrarse; conserva sus vistas y conversiones."} submitLabel={next.label} action={changePopupStatus} fields={{ code: popup.code, status: next.value }} />
      ))}
      {popup.status === "activo" ? (
        <RowIcon tone="delete" label="Eliminar" disabledHint="Pausa el popup antes de eliminarlo" />
      ) : (
        <ConsoleAction id={`popup-eliminar-${popup.code}`} label="Eliminar" icon={<Trash2 size={15} />} rowTone="delete" title={`Eliminar ${popup.code}`} description="Se borra con sus vistas y conversiones. Queda en la auditoría." submitLabel="Eliminar" action={deletePopup} fields={{ code: popup.code }} />
      )}
    </RowActions>
  );
}

export function PopupsTable({ overview }: { overview: PopupsOverview }) {
  const columns: Column<ConsolePopup>[] = [
    { id: "popup", header: "Popup", mobile: "title", cell: (row) => <span className="flex flex-col"><b className="text-[13.5px]">{row.name}</b><small className="text-[12px] text-fg-3">{row.code} · {row.kind_label}</small></span> },
    { id: "trigger", header: "Cuándo", cell: (row) => <span className="text-[13px]">{row.trigger_label}<small className="block text-[12px] text-fg-3">1 vez cada {row.freq_days} días</small></span> },
    { id: "pages", header: "Páginas", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.page_labels.join(", ")}</span> },
    { id: "views", header: "Vistas", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.views)}</span> },
    { id: "conversion", header: "Conversión", align: "right", cell: (row) => <span className="font-mono text-[13px]">{percent(row.conversion_pct)}<small className="block text-[11.5px] text-fg-3">{formatNumber(row.conversions)}</small></span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={POPUP_TONE[row.status]}>{row.status_label}</Badge> },
    { id: "actions", header: "", cell: (row) => <PopupActions popup={row} options={overview.options} /> },
  ];
  const rate = overview.counts.views > 0 ? (overview.counts.conversions / overview.counts.views) * 100 : null;
  const metrics: MetricFilter<ConsolePopup>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <Play size={19} />, info: <p>Popups que se muestran hoy. Cada visita ve uno como máximo y nunca en el alta ni a quien ya tiene sesión (LND-13).</p>, matches: (row) => row.status === "activo" },
    { id: "paused", label: "Pausados o en borrador", tone: "mute", icon: <MegaphoneOff size={19} />, info: <p>Popups que no se muestran. Los borradores aún no se activaron nunca.</p>, matches: (row) => row.status !== "activo" },
    { id: "views", label: "Vistas", tone: "t1", icon: <Eye size={19} />, display: formatNumber(overview.counts.views), note: `${formatNumber(overview.counts.conversions)} conversiones · ${percent(rate)}`, info: <p>Suma de las veces que se mostró cada popup y de las conversiones: correo enviado, suscripción al boletín o clic en el botón.</p>, matches: (row) => row.views > 0 },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ConsoleAction id="popup-nuevo" label="Nuevo popup" icon={<Plus size={16} />} variant="primary" title="Nuevo popup" description="Se crea en borrador; actívalo cuando esté listo." submitLabel="Crear" action={createPopup}>
          <PopupFields options={overview.options} />
        </ConsoleAction>
      </div>
      <DataTable screen="plataforma-landing-popups" rows={overview.items} columns={columns} getKey={(row) => row.code} entityLabel="popups" searchText={(row) => `${row.code} ${row.name} ${row.title}`} searchPlaceholder="Buscar popup" metrics={metrics} filters={[{ id: "estado", label: "Estado", options: overview.options.statuses, value: (row) => row.status }]} sorts={[{ id: "views", label: "Vistas", type: "number", value: (row) => row.views }]} emptyTitle="Aún no hay popups" />
    </div>
  );
}

export function SubscribersTable({ overview }: { overview: SubscribersOverview }) {
  const columns: Column<Subscriber>[] = [
    { id: "email", header: "Correo", mobile: "title", cell: (row) => <span className="flex items-center gap-2 text-[13.5px]"><Mail size={15} className="text-fg-3" />{row.email}</span> },
    { id: "source", header: "Se suscribió desde", cell: (row) => <span className="text-[13px] text-fg-2">{row.source_label}</span> },
    { id: "created", header: "Fecha", cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{formatDateTime(row.created_at)}</span> },
    { id: "confirmed", header: "Confirmó", wideOnly: true, cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{row.confirmed_at ? formatDateTime(row.confirmed_at) : "—"}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={SUBSCRIBER_TONE[row.status]}>{row.status_label}</Badge> },
  ];
  const best = [...overview.sources].sort((a, b) => b.confirmed - a.confirmed)[0];
  const metrics: MetricFilter<Subscriber>[] = [
    { id: "confirmed", label: "Confirmados", tone: "ok", icon: <MailCheck size={19} />, info: <p>Correos que confirmaron con el enlace del primer mensaje (doble confirmación, LND-14). Solo a ellos se les envía el boletín.</p>, matches: (row) => row.status === "confirmado" },
    { id: "pending", label: "Por confirmar", tone: "warn", icon: <Send size={19} />, info: <p>Recibieron el correo de confirmación y todavía no hacen clic. Si vuelven a suscribirse se reenvía, como mucho cada 10 minutos.</p>, matches: (row) => row.status === "pendiente" },
    { id: "unsubscribed", label: "De baja", tone: "mute", icon: <MailX size={19} />, info: <p>Se dieron de baja con el enlace de un clic que va en cada correo. No se les vuelve a escribir.</p>, matches: (row) => row.status === "baja" },
    { id: "source", label: "Mejor origen", tone: "t1", icon: <MousePointerClick size={19} />, display: best?.label ?? "—", note: best ? `${best.confirmed} confirmados` : undefined, info: <p>Lugar de la página que trajo más suscriptores confirmados: pie, blog, 60 % del artículo o popup al salir.</p>, matches: (row) => row.source === best?.value },
  ];
  return <DataTable screen="plataforma-landing-boletin" rows={overview.items} columns={columns} getKey={(row) => row.id} entityLabel="suscriptores" searchText={(row) => row.email} searchPlaceholder="Buscar correo" metrics={metrics} filters={[{ id: "origen", label: "Origen", options: overview.sources, value: (row) => row.source }]} sorts={[{ id: "created", label: "Fecha", type: "date", value: (row) => row.created_at }]} emptyTitle="Aún no hay suscriptores" />;
}

function PostFields({ overview, post }: { overview: PostsOverview; post?: ConsolePost }) {
  const [category, setCategory] = useState(post?.category ?? overview.categories[0]?.value ?? "");
  const [featured, setFeatured] = useState(post?.featured ?? false);
  const [comments, setComments] = useState(post?.allow_comments ?? true);
  return (
    <>
      <TextField label="Título" name="title" required maxLength={200} defaultValue={post?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Complemento del título" name="title_accent" maxLength={120} defaultValue={post?.title_accent ?? ""} hint="Opcional, se muestra en color." />
        <TextField label="Dirección" name="slug" maxLength={150} defaultValue={post?.slug ?? ""} hint="Se arma del título si la dejas vacía." />
      </div>
      <TextArea label="Resumen" name="excerpt" rows={2} required maxLength={320} defaultValue={post?.excerpt} hint="Se usa en las tarjetas y como descripción para buscadores." />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Categoría" name="category" options={overview.categories} value={category} onChange={setCategory} />
        <TextField label="Palabra clave" name="focus_keyword" required maxLength={120} defaultValue={post?.focus_keyword} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Autor" name="author_name" maxLength={80} defaultValue={post?.author_name ?? ""} />
        <TextField label="Cargo del autor" name="author_role" maxLength={120} defaultValue={post?.author_role ?? ""} />
      </div>
      <TextArea label="Contenido" name="body" rows={14} defaultValue={post?.body ?? ""} hint={`Al menos ${overview.rules.min_words} palabras para publicar. «## » abre una sección del índice, «- » una lista, «> Título: texto» un consejo, «| a | b |» una tabla y [[maqueta:cotizador]] la maqueta del cotizador.`} />
      <TextArea label="Preguntas frecuentes" name="faq" rows={5} defaultValue={post ? faqToText(post.faq) : ""} hint="Una pregunta por bloque: la pregunta en la primera línea y la respuesta debajo. Deja una línea en blanco entre bloques." />
      <SwitchField label="Destacar en el blog" name="featured" checked={featured} onCheckedChange={setFeatured} hint="Solo un artículo se destaca a la vez." />
      <SwitchField label="Recibir comentarios" name="allow_comments" checked={comments} onCheckedChange={setComments} />
    </>
  );
}

function PostActions({ post, overview }: { post: ConsolePost; overview: PostsOverview }) {
  return (
    <RowActions>
      <RowIcon tone="view" label="Ver en el blog" icon={<ExternalLink size={15} />} href={post.status === "publicado" ? post.href : undefined} disabledHint={post.status === "publicado" ? undefined : "Todavía no está publicado"} />
      <ConsoleAction id={`post-editar-${post.id}`} label="Editar" icon={<FilePen size={15} />} rowTone="edit" title="Editar artículo" description={post.title} submitLabel="Guardar" action={updatePost} fields={{ id: post.id }}>
        <PostFields overview={overview} post={post} />
      </ConsoleAction>
      {post.next.map((next) => (
        <ConsoleAction key={next.value} id={`post-${next.value}-${post.id}`} label={next.label} icon={next.value === "publicado" ? <Sparkles size={15} /> : next.value === "archivado" ? <CircleSlash size={15} /> : <FilePen size={15} />} rowTone="neutral" title={`${next.label}: ${post.title}`} description={next.value === "publicado" ? `Se publica en /software/blog con ${post.word_count} palabras.` : next.value === "archivado" ? "Deja de verse en el blog; conserva lecturas y comentarios." : "Sale del blog y vuelve a borrador para editarlo."} submitLabel={next.label} action={changePostStatus} fields={{ id: post.id, status: next.value }} />
      ))}
      {post.deletable ? (
        <ConsoleAction id={`post-eliminar-${post.id}`} label="Eliminar" icon={<Trash2 size={15} />} rowTone="delete" title="Eliminar borrador" description={post.title} submitLabel="Eliminar" action={deletePost} fields={{ id: post.id }} />
      ) : (
        <RowIcon tone="delete" label="Eliminar" disabledHint="Ya se publicó: archívalo para retirarlo" />
      )}
    </RowActions>
  );
}

export function PostsTable({ overview }: { overview: PostsOverview }) {
  const columns: Column<ConsolePost>[] = [
    { id: "post", header: "Artículo", mobile: "title", cell: (row) => <span className="flex max-w-[420px] flex-col whitespace-normal"><b className="text-[13.5px] leading-snug">{row.title}</b><small className="text-[12px] text-fg-3">{row.category_label ?? "Sin categoría"} · {row.author_name ?? "Equipo KipuControl"}{row.featured ? " · destacado" : ""}</small></span> },
    { id: "words", header: "Palabras", align: "right", wideOnly: true, cell: (row) => <span className={row.word_count < overview.rules.min_words ? "font-mono text-[13px] text-bad" : "font-mono text-[13px]"}>{formatNumber(row.word_count)}</span> },
    { id: "reads", header: "Lecturas", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.reads)}</span> },
    { id: "comments", header: "Comentarios", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.comments.approved}{row.comments.pending > 0 && <small className="block text-[11.5px] text-warn">{row.comments.pending} por revisar</small>}</span> },
    { id: "published", header: "Publicado", wideOnly: true, cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{row.published_at ? formatDateTime(row.published_at) : "—"}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={POST_TONE[row.status]}>{row.status_label}</Badge> },
    { id: "actions", header: "", cell: (row) => <PostActions post={row} overview={overview} /> },
  ];
  const metrics: MetricFilter<ConsolePost>[] = [
    { id: "published", label: "Publicados", tone: "ok", icon: <BookOpenText size={19} />, info: <p>Artículos visibles en /software/blog. También salen en el sitemap y en /llms.txt.</p>, matches: (row) => row.status === "publicado" },
    { id: "drafts", label: "Borradores", tone: "warn", icon: <FilePen size={19} />, info: <p>Artículos en preparación. Para publicarlos necesitan categoría y al menos {overview.rules.min_words} palabras.</p>, matches: (row) => row.status === "borrador" },
    { id: "reads", label: "Lecturas", tone: "t1", icon: <Eye size={19} />, display: formatNumber(overview.counts.reads), note: "Una por visitante al día", info: <p>Suma de lecturas de todos los artículos. Se cuenta una vez por visitante y día, sin cookies.</p>, matches: (row) => row.reads > 0 },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ConsoleAction id="post-nuevo" label="Nuevo artículo" icon={<Plus size={16} />} variant="primary" title="Nuevo artículo" description="Se guarda como borrador en el blog de KipuControl." submitLabel="Crear borrador" action={createPost}>
          <PostFields overview={overview} />
        </ConsoleAction>
      </div>
      <DataTable screen="plataforma-landing-articulos" rows={overview.items} columns={columns} getKey={(row) => row.id} entityLabel="artículos" searchText={(row) => `${row.title} ${row.focus_keyword} ${row.author_name ?? ""}`} searchPlaceholder="Buscar artículo o palabra clave" metrics={metrics} filters={[{ id: "categoria", label: "Categoría", options: overview.categories, value: (row) => row.category ?? "" }]} sorts={[{ id: "reads", label: "Lecturas", type: "number", value: (row) => row.reads }]} emptyTitle="Aún no hay artículos" />
    </div>
  );
}
