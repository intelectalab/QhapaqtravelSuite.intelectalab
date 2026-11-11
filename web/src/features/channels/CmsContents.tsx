"use client";

import { Archive, ArrowRight, FileText, Globe, Image as ImageIcon, Plus, Scale, Search, SendHorizontal } from "lucide-react";
import { archiveContent, saveContent, transitionContent } from "@/app/(backoffice)/canales/cms/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { RichText } from "@/components/ui/RichText";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { CMS_ACTIONS, CMS_FLOW, channelStatus, type CmsContent, type CmsOverview } from "@/lib/channels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";
import { ChannelBadge, DetailPanel, PanelSection, Timeline } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

const TYPE_ICON: Record<string, typeof FileText> = { Página: Globe, Artículo: FileText, Banner: ImageIcon, "Página legal": Scale, Landing: Globe };

export function CmsFlow({ kpis }: { kpis: Record<string, number> }) {
  return (
    <ol className="mb-5 flex flex-wrap items-stretch gap-2">
      {CMS_FLOW.map((status, index) => {
        const meta = channelStatus(status);
        return (
          <li key={status} className="flex items-center gap-2">
            <span style={{ ...toneStyle(meta.tone), animationDelay: `${index * 70}ms` }} className="lift flex min-w-[132px] animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-[var(--tint)]">{meta.label}</span>
              <b className="text-[22px] leading-tight tracking-tight">{kpis[status] ?? 0}</b>
            </span>
            {index < CMS_FLOW.length - 1 && <ArrowRight size={15} className="text-fg-3" />}
          </li>
        );
      })}
    </ol>
  );
}

export function ContentFormAction({ content, overview, iconOnly = false }: { content?: CmsContent; overview: Pick<CmsOverview, "types" | "channels">; iconOnly?: boolean }) {
  return (
    <PanelAction<StepResult>
      label={content ? "Editar" : "Nuevo contenido"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={content ? `cms-${content.code}` : "cms-new"}
      title={content ? "Editar contenido" : "Nuevo contenido"}
      description={content ? `${content.code} · ${channelStatus(content.status).label}${content.status === "publicado" ? ". Los cambios se ven de inmediato." : ""}` : "Se guarda como borrador. Luego lo envías a revisión."}
      submitLabel={content ? "Guardar cambios" : "Crear borrador"}
      action={saveContent}
      initial={initial}
      trigger={iconOnly ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {content && <input type="hidden" name="code" value={content.code} />}
          {content && <input type="hidden" name="lock_version" value={content.lock_version} />}
          <TextField label="Título" name="title" required minLength={3} maxLength={200} defaultValue={content?.title} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tipo" name="type" options={overview.types.map((value) => ({ value, label: value }))} defaultValue={content?.type ?? overview.types[0]} />
            <SelectField label="Canal" name="channel" options={overview.channels.map((value) => ({ value, label: value }))} defaultValue={content?.channel ?? overview.channels[0]} />
          </div>
          <TextField label="URL" name="slug" maxLength={60} defaultValue={content?.slug} hint="Si la dejas vacía, se genera a partir del título." />
          <TextArea label="Contenido" name="body" rows={9} required defaultValue={content?.body} hint="Usa ## para subtítulos y - para listas." />
          <PanelSection title="Buscadores">
            <TextField label="Título SEO" name="seo_title" maxLength={60} defaultValue={content?.seo_title ?? undefined} hint="Obligatorio para publicar. Hasta 60 caracteres." icon={<Search size={17} />} />
            <TextArea label="Descripción SEO" name="seo_description" rows={2} maxLength={160} defaultValue={content?.seo_description ?? undefined} />
          </PanelSection>
          <PanelSection title="Vigencia (banners y landings)">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Desde" name="valid_from" type="date" defaultValue={content?.valid_from ?? undefined} />
              <TextField label="Hasta" name="valid_to" type="date" defaultValue={content?.valid_to ?? undefined} />
            </div>
          </PanelSection>
        </>
      )}
    </PanelAction>
  );
}

function TransitionAction({ content, to }: { content: CmsContent; to: string }) {
  const meta = CMS_ACTIONS[to];
  return (
    <PanelAction<StepResult>
      label={meta.label}
      formId={`cms-${content.code}-${to}`}
      title={meta.label}
      description={`${content.title}. ${meta.hint}`}
      submitLabel={meta.label}
      action={transitionContent}
      initial={initial}
      trigger={(open) => (
        <button type="button" onClick={open} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent/10 px-2.5 text-[12.5px] font-semibold text-accent transition-transform duration-300 hover:-translate-y-0.5">
          <SendHorizontal size={13} />
          {meta.label}
        </button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={content.code} />
          <input type="hidden" name="lock_version" value={content.lock_version} />
          <input type="hidden" name="to" value={to} />
          {meta.reason ? <TextArea label="Motivo" name="reason" rows={3} required maxLength={300} /> : <p className="text-[13px] text-fg-2">{to === "publicado" && !content.seo_title ? "Falta el título SEO: complétalo antes de publicar." : "Confirma para continuar."}</p>}
        </>
      )}
    </PanelAction>
  );
}

function ArchiveAction({ content }: { content: CmsContent }) {
  if (content.status === "publicado") return <RowIcon tone="delete" label="Archivar" icon={<Archive size={15} />} disabledHint="Despublícalo antes de archivarlo" />;
  return (
    <PanelAction<StepResult>
      label="Archivar"
      formId={`cms-archive-${content.code}`}
      title="Archivar contenido"
      description={`${content.title}. Sale de la lista y libera su URL; la bitácora se conserva.`}
      submitLabel="Archivar"
      action={archiveContent}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Archivar" icon={<Archive size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="code" value={content.code} />}
    </PanelAction>
  );
}

function Markdown({ body }: { body: string }) {
  return <RichText body={body} size="sm" className="rounded-tile border border-line bg-surface-2/50 p-4" />;
}

function ContentDetail({ content }: { content: CmsContent }) {
  return (
    <DetailPanel label="Ver contenido" title={content.title} description={`${content.code} · /${content.slug}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge status={content.status} />
        <span className="text-[12.5px] text-fg-3">{content.type} · {content.channel}</span>
      </div>
      <PanelSection title="Vista previa">
        <Markdown body={content.body} />
      </PanelSection>
      <PanelSection title="Ficha">
        <FieldList
          fields={[
            { label: "Autor", value: content.author },
            { label: "Título SEO", value: content.seo_title ?? <span className="text-warn">Falta para publicar</span> },
            { label: "Publicado", value: content.published_at ? formatDateTime(content.published_at) : "—" },
            { label: "Vigencia", value: content.valid_from || content.valid_to ? `${content.valid_from ? formatDate(content.valid_from) : "—"} – ${content.valid_to ? formatDate(content.valid_to) : "—"}` : "Sin límite" },
          ]}
        />
      </PanelSection>
      <PanelSection title="Bitácora" aside={`${content.log.length}`}>
        <Timeline items={content.log.map((entry, index) => ({ key: `${entry.at}-${index}`, title: entry.message, meta: `${entry.user} · ${formatDateTime(entry.at)}` }))} />
      </PanelSection>
    </DetailPanel>
  );
}

export function CmsTable({ overview }: { overview: CmsOverview }) {
  const rows = overview.items;
  const columns: Column<CmsContent>[] = [
    {
      id: "title",
      header: "Contenido",
      mobile: "title",
      cell: (row) => {
        const Icon = TYPE_ICON[row.type] ?? FileText;
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-accent/10 text-accent">
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[13.5px] font-semibold">{row.title}</b>
              <span className="text-[12px] text-fg-3">/{row.slug}</span>
            </span>
          </span>
        );
      },
    },
    { id: "type", header: "Tipo", cell: (row) => <span className="text-[13px]">{row.type}</span> },
    { id: "channel", header: "Canal", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{row.channel}</span> },
    { id: "updated", header: "Actualizado", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.author} · {formatDate(row.updated_at)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {overview.can_publish && row.next.map((to) => <TransitionAction key={to} content={row} to={to} />)}
          <ContentDetail content={row} />
          {overview.can_publish && (
            <>
              <ContentFormAction content={row} overview={overview} iconOnly />
              <ArchiveAction content={row} />
            </>
          )}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<CmsContent>[] = [
    { id: "pages", label: "Páginas", tone: "t1", icon: <Globe size={19} />, matches: (row) => row.type === "Página" || row.type === "Landing" },
    { id: "articles", label: "Artículos", tone: "violet", icon: <FileText size={19} />, matches: (row) => row.type === "Artículo" },
    { id: "banners", label: "Banners", tone: "sun", icon: <ImageIcon size={19} />, matches: (row) => row.type === "Banner" },
    { id: "legal", label: "Legales", tone: "mute", icon: <Scale size={19} />, matches: (row) => row.type === "Página legal" },
  ];
  const filters: FilterConfig<CmsContent>[] = [
    { id: "status", label: "Estado", options: CMS_FLOW.map((value) => ({ value, label: channelStatus(value).label })), value: (row) => row.status },
    { id: "channel", label: "Canal", options: overview.channels.map((value) => ({ value, label: value })), value: (row) => row.channel },
  ];
  const sorts: SortOption<CmsContent>[] = [
    { id: "updated", label: "Actualización", type: "date", value: (row) => row.updated_at },
    { id: "title", label: "Título", value: (row) => row.title },
  ];
  return <DataTable screen="canales-cms" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="contenidos" searchText={(row) => `${row.title} ${row.slug} ${row.author} ${row.code}`} searchPlaceholder="Buscar título, URL o autor" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin contenidos" />;
}
