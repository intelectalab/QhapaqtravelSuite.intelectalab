"use client";

import { Building2, CheckCircle2, Eye, Pause, Percent, Play, Plus, ShieldCheck, Ticket, TrendingUp, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { decideListing, moderateAgency, publishPost, savePost } from "@/app/plataforma/(consola)/vitrina/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { ConsoleAction } from "@/features/platform/ConsoleAction";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { ConsoleResult } from "@/lib/server/platformConsole";
import { cityLabel, monthLabel, type BlogPost, type FunnelMonth, type ModerationOverview, type PostsOverview, type ShowcaseListing } from "@/lib/vitrina";
import { Meter, TabCard, VitrinaBadge } from "./VitrinaUi";

type Agency = ModerationOverview["agencies"][number];

const initial: ConsoleResult = { message: null, done: false };

const STEPS: { key: keyof FunnelMonth; label: string }[] = [
  { key: "visita", label: "Visitas" },
  { key: "reserva", label: "Reservas" },
  { key: "registro_agencia", label: "Agencias registradas" },
  { key: "pase_iniciado", label: "Pases iniciados" },
  { key: "plan_pagado", label: "Planes pagados" },
];

export function ShowcaseTiles({ overview }: { overview: ModerationOverview }) {
  const k = overview.kpis;
  return (
    <TileGrid className="xl:grid-cols-5">
      <TintTile icon={Eye} tone="info" label="Visitas del mes" value={formatNumber(k.month_visits)} info={<p>Visitas a fichas de tours registradas en el embudo de la vitrina este mes.</p>} />
      <TintTile icon={Ticket} tone="t1" label="Reservas del mes" value={formatNumber(k.month_bookings)} note={k.month_visits ? `${((k.month_bookings / k.month_visits) * 100).toFixed(1)} % de conversión` : undefined} info={<p>Reservas hechas en la vitrina este mes, según el embudo.</p>} />
      <TintTile icon={Building2} tone="violet" label="Agencias" value={k.agencies} note={`${k.pending_agencies} por verificar`} info={<p>Agencias en la vitrina, con o sin cuenta de KipuControl.</p>} />
      <TintTile icon={ShieldCheck} tone="sun" label="Por moderar" value={k.pending_listings} note={`${k.published} publicadas`} info={<p>Publicaciones enviadas a revisión por las agencias.</p>} />
      <TintTile icon={Percent} tone="ok" label="Cargos y comisiones" value={formatMoney(k.fees, "PEN")} info={<p>Suma de cargos por asistente y comisiones de tours de pago de todas las reservas no canceladas.</p>} />
    </TileGrid>
  );
}

function ListingsQueue({ listings }: { listings: ShowcaseListing[] }) {
  const columns: Column<ShowcaseListing>[] = [
    { id: "title", header: "Tour", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block truncate text-[13.5px]">{row.title}</b><span className="block max-w-[340px] truncate text-[12px] text-fg-3">{row.meeting_point}</span>{row.reject_reason && <span className="block text-[12px] text-bad">{row.reject_reason}</span>}</span> },
    { id: "agency", header: "Agencia", cell: (row) => <span className="text-[13px]">{row.agency.name}<span className="block text-[12px]">{row.agency.verified ? <span className="text-ok">Verificada</span> : <span className="text-warn">Sin verificar</span>}</span></span> },
    { id: "city", header: "Ciudad", cell: (row) => <span className="text-[13px]">{cityLabel(row.city)}</span> },
    { id: "model", header: "Tipo", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.model === "pago" ? formatMoney(row.price, row.currency) : "Free tour"}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        row.status === "en_revision" ? (
          <RowActions>
            <ConsoleAction id={`mod-ok-${row.code}`} label="Aprobar" icon={<CheckCircle2 size={15} />} rowTone="view" title="Aprobar publicación" description={row.agency.verified ? `${row.title} se publica en la vitrina.` : `Verifique antes a ${row.agency.name}: sin RUC y licencia verificados no se publica.`} submitLabel="Aprobar" action={decideListing} fields={{ code: row.code, decision: "aprobar" }} />
            <ConsoleAction id={`mod-no-${row.code}`} label="Rechazar" icon={<XCircle size={15} />} rowTone="delete" title="Rechazar publicación" description="El motivo se envía a la agencia." submitLabel="Rechazar" action={decideListing} fields={{ code: row.code, decision: "rechazar" }}>
              <TextArea label="Motivo" name="reason" rows={3} required maxLength={500} />
            </ConsoleAction>
          </RowActions>
        ) : null,
    },
  ];
  return <DataTable screen="plataforma-vitrina-moderacion" rows={listings} columns={columns} getKey={(row) => row.code} entityLabel="publicaciones" searchText={(row) => `${row.title} ${row.agency.name} ${row.city}`} searchPlaceholder="Buscar tour o agencia" emptyTitle="Sin publicaciones por revisar" />;
}

function AgencyActions({ agency }: { agency: Agency }) {
  const actions: { key: string; label: string; icon: ReactNode; tone: "view" | "delete" | "neutral"; reason?: boolean }[] =
    agency.status === "en_revision"
      ? [{ key: "verificar", label: "Verificar", icon: <ShieldCheck size={15} />, tone: "view" }, { key: "rechazar", label: "Rechazar", icon: <XCircle size={15} />, tone: "delete", reason: true }]
      : agency.status === "activa"
        ? [{ key: "suspender", label: "Suspender", icon: <Pause size={15} />, tone: "delete", reason: true }]
        : agency.status === "suspendida"
          ? [{ key: "reactivar", label: "Reactivar", icon: <Play size={15} />, tone: "view" }]
          : [{ key: "verificar", label: "Verificar", icon: <ShieldCheck size={15} />, tone: "view" }];
  return (
    <RowActions>
      {actions.map((action) => (
        <ConsoleAction key={action.key} id={`ag-${action.key}-${agency.code}`} label={action.label} icon={action.icon} rowTone={action.tone} title={`${action.label} agencia`} description={`${agency.name}${agency.ruc ? ` · RUC ${agency.ruc}` : ""}${agency.license_ref ? ` · licencia ${agency.license_ref}` : ""}`} submitLabel={action.label} action={moderateAgency} fields={{ code: agency.code, action: action.key }}>
          {action.reason ? <TextArea label="Motivo" name="reason" rows={3} required maxLength={300} /> : <p className="text-[13px] text-fg-2">{action.key === "verificar" ? "Confirma que revisó el RUC y la licencia de turismo." : "Confirma para continuar."}</p>}
        </ConsoleAction>
      ))}
    </RowActions>
  );
}

function AgenciesTable({ agencies }: { agencies: Agency[] }) {
  const columns: Column<Agency>[] = [
    { id: "name", header: "Agencia", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block truncate text-[13.5px]">{row.name}</b><span className="text-[12px] text-fg-3">{row.has_account ? "Con cuenta KipuControl" : "Sin cuenta"} · {row.email}</span></span> },
    { id: "city", header: "Ciudad", cell: (row) => <span className="text-[13px]">{cityLabel(row.city)}</span> },
    { id: "plan", header: "Plan", cell: (row) => <span className="text-[13px]">{row.plan}</span> },
    { id: "listings", header: "Tours", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.listings}</span> },
    { id: "bookings", header: "Reservas", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.bookings}</span> },
    { id: "fees", header: "Cargos", align: "right", wideOnly: true, cell: (row) => formatMoney(row.fees, "PEN") },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    { id: "actions", header: "", cell: (row) => <AgencyActions agency={row} /> },
  ];
  const metrics: MetricFilter<Agency>[] = [
    { id: "review", label: "Por verificar", tone: "sun", icon: <ShieldCheck size={19} />, matches: (row) => row.status === "en_revision" },
    { id: "account", label: "Con cuenta", tone: "t1", icon: <Building2 size={19} />, matches: (row) => row.has_account },
  ];
  const sorts: SortOption<Agency>[] = [{ id: "bookings", label: "Reservas", type: "number", value: (row) => row.bookings }];
  return <DataTable screen="plataforma-vitrina-agencias" rows={agencies} columns={columns} getKey={(row) => row.code} entityLabel="agencias" searchText={(row) => `${row.name} ${row.email} ${row.city} ${row.ruc ?? ""}`} searchPlaceholder="Buscar agencia, correo o RUC" metrics={metrics} sorts={sorts} emptyTitle="Sin agencias" />;
}

function FunnelPanel({ months }: { months: FunnelMonth[] }) {
  const current = months[0];
  if (!current) return <p className="py-8 text-center text-[13.5px] text-fg-2">Aún no hay eventos en el embudo.</p>;
  const top = Math.max(1, Number(current.visita));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold capitalize text-fg-2">{monthLabel(current.month)}</p>
        {STEPS.map((step, index) => {
          const value = Number(current[step.key] ?? 0);
          return (
            <div key={step.key} style={{ animationDelay: `${index * 70}ms` }} className="group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
              <div className="mb-1 flex justify-between text-[13px]"><span>{step.label}</span><b className="font-mono">{formatNumber(value)}</b></div>
              <Meter value={value} max={top} tone={index === 0 ? "info" : index === 1 ? "t1" : index < 4 ? "violet" : "ok"} className="h-2.5 group-hover:h-3" />
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead><tr className="border-b border-line text-left text-[12px] text-fg-3"><th className="py-2 font-medium">Mes</th>{STEPS.map((step) => <th key={step.key} className="py-2 text-right font-medium">{step.label}</th>)}</tr></thead>
          <tbody>{months.map((month) => <tr key={month.month} className="border-b border-line-2 transition-colors hover:bg-surface-2/60"><td className="py-2 capitalize">{monthLabel(month.month)}</td>{STEPS.map((step) => <td key={step.key} className="py-2 text-right font-mono">{formatNumber(Number(month[step.key] ?? 0))}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function PostFormAction({ post, posts }: { post?: BlogPost; posts: PostsOverview }) {
  return (
    <PanelAction<ConsoleResult>
      label={post ? "Editar" : "Nuevo artículo"}
      icon={<Plus size={15} />}
      size="sm"
      formId={post ? `post-${post.id}` : "post-new"}
      title={post ? "Editar artículo" : "Nuevo artículo"}
      description={`Para publicar: ${posts.rules.min_words} palabras o más, palabra clave y ${posts.rules.min_listings} tours enlazados de la ciudad.`}
      submitLabel={post ? "Guardar" : "Crear borrador"}
      action={savePost}
      initial={initial}
      trigger={post ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {post && <input type="hidden" name="id" value={post.id} />}
          <TextField label="Título" name="title" required minLength={10} maxLength={200} defaultValue={post?.title} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Palabra clave" name="focus_keyword" required maxLength={120} defaultValue={post?.focus_keyword} />
            <SelectField label="Ciudad" name="city" options={[{ value: "", label: "Todo Perú" }, ...Array.from(new Set(posts.listings.map((listing) => listing.city))).map((city) => ({ value: city, label: cityLabel(city) }))]} defaultValue={post?.city ?? ""} />
          </div>
          <TextArea label="Resumen" name="excerpt" rows={2} required minLength={20} maxLength={320} defaultValue={post?.excerpt} />
          <TextArea label="Artículo" name="body" rows={8} defaultValue={post?.body ?? undefined} hint={post && !post.body ? `El texto vive en Payload (${post.word_count} palabras); escriba aquí solo para reemplazarlo.` : "Se cuenta el número de palabras al guardar."} />
          <ChipToggleGroup label="Tours enlazados" name="linked_listings" options={posts.listings.map((listing) => ({ value: listing.id, label: `${listing.title} · ${cityLabel(listing.city)}` }))} defaultValue={post?.linked_listing_ids ?? []} />
        </>
      )}
    </PanelAction>
  );
}

function PostsPanel({ posts }: { posts: PostsOverview }) {
  const columns: Column<BlogPost>[] = [
    { id: "title", header: "Artículo", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block truncate text-[13.5px]">{row.title}</b><span className="font-mono text-[12px] text-fg-3">/blog/{row.slug}</span></span> },
    { id: "keyword", header: "Palabra clave", cell: (row) => <span className="text-[13px]">{row.focus_keyword}</span> },
    { id: "words", header: "Palabras", cell: (row) => <span className="flex min-w-[110px] flex-col gap-1"><span className="font-mono text-[12.5px]">{formatNumber(row.word_count)}</span><Meter value={row.word_count} max={posts.rules.min_words} tone={row.word_count >= posts.rules.min_words ? "ok" : "warn"} /></span> },
    { id: "tours", header: "Tours", align: "right", wideOnly: true, cell: (row) => <span className={`font-mono text-[13px] ${row.linked_listing_ids.length >= posts.rules.min_listings ? "" : "text-warn"}`}>{row.linked_listing_ids.length}</span> },
    { id: "published", header: "Publicado", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.published_at ? formatDate(row.published_at) : "—"}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {row.status !== "publicado" ? (
            <ConsoleAction id={`post-pub-${row.id}`} label="Publicar" icon={<TrendingUp size={15} />} rowTone="view" title="Publicar artículo" description={`${row.title}. Se valida el mínimo de palabras, la palabra clave y los tours enlazados.`} submitLabel="Publicar" action={publishPost} fields={{ id: row.id, status: "publicado" }} />
          ) : (
            <ConsoleAction id={`post-arch-${row.id}`} label="Archivar" icon={<XCircle size={15} />} rowTone="delete" title="Archivar artículo" description={`${row.title} deja de mostrarse en el blog de la vitrina.`} submitLabel="Archivar" action={publishPost} fields={{ id: row.id, status: "archivado" }} />
          )}
          <PostFormAction post={row} posts={posts} />
        </RowActions>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[72ch] text-[13px] text-fg-2">Los artículos se escriben en Payload y aquí queda el índice sincronizado. Flujo sugerido: palabra clave, borrador revisado, 3 tours de la ciudad, publicar y medir a los 28 días.</p>
        <PostFormAction posts={posts} />
      </div>
      <DataTable screen="plataforma-vitrina-blog" rows={posts.items} columns={columns} getKey={(row) => row.id} entityLabel="artículos" searchText={(row) => `${row.title} ${row.focus_keyword} ${row.slug}`} searchPlaceholder="Buscar artículo o palabra clave" emptyTitle="Sin artículos" />
    </div>
  );
}

export function PlatformShowcaseTabs({ overview, funnel, posts }: { overview: ModerationOverview; funnel: FunnelMonth[]; posts: PostsOverview }) {
  return (
    <TabCard
      tabs={[
        { id: "moderacion", label: "Moderación", count: overview.kpis.pending_listings, content: <ListingsQueue listings={overview.listings} /> },
        { id: "agencias", label: "Agencias", count: overview.agencies.length, content: <AgenciesTable agencies={overview.agencies} /> },
        { id: "embudo", label: "Embudo", content: <FunnelPanel months={funnel} /> },
        { id: "blog", label: "Blog SEO", count: posts.items.length, content: <PostsPanel posts={posts} /> },
      ]}
    />
  );
}
