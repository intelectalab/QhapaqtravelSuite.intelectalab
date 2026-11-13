"use client";

import { Camera, Eye, FilePen, Globe, MailCheck, Plus, Send, ShieldCheck, ShieldQuestion, Undo2 } from "lucide-react";
import { deleteStory, publishStory, requestConsent, saveStory, unpublishStory } from "@/app/(backoffice)/canales/aventuras/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { DetailPanel, PanelSection, TileGrid } from "@/features/channels/ChannelUi";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { StoriesOverview, TravelStory } from "@/lib/vitrina";
import { initialStep, QuickAction, VitrinaBadge } from "./VitrinaUi";

const CHANNELS: Record<string, string> = { portal: "Portal del cliente", correo_firmado: "Correo firmado", whatsapp: "WhatsApp", presencial: "Presencial" };

const NAME_MODES: Record<string, string> = { nombre_completo: "Nombre completo", solo_nombre: "Solo el nombre", anonimo: "Anónimo" };

export function StoryTiles({ overview }: { overview: StoriesOverview }) {
  return (
    <TileGrid>
      <TintTile icon={Globe} tone="ok" label="Publicadas" value={overview.kpis.publicado ?? 0} note="En /aventuras del sitio" info={<p>Historias visibles en el sitio de la agencia. Solo se publican con consentimiento vigente del cliente.</p>} />
      <TintTile icon={ShieldQuestion} tone="sun" label="Esperando consentimiento" value={overview.kpis.pendiente_consentimiento ?? 0} note="Solicitud enviada al cliente" info={<p>Historias con la solicitud de autorización enviada al correo y al portal del cliente.</p>} />
      <TintTile icon={FilePen} tone="t1" label="Borradores" value={overview.kpis.borrador ?? 0} info={<p>Historias creadas desde una reserva que aún no piden autorización.</p>} />
      <TintTile icon={Eye} tone="info" label="Lecturas" value={formatNumber(overview.kpis.views ?? 0)} info={<p>Visitas a las historias publicadas en el sitio, sumadas desde su publicación.</p>} />
    </TileGrid>
  );
}

export function StoryFormAction({ story, overview }: { story?: TravelStory; overview: StoriesOverview }) {
  return (
    <PanelAction<StepResult>
      label={story ? "Editar" : "Nueva historia"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={story ? `av-${story.id}` : "av-new"}
      title={story ? "Editar historia" : "Nueva historia"}
      description={story ? story.title : "Se crea como borrador a partir de una reserva. Luego pide el consentimiento del cliente."}
      submitLabel={story ? "Guardar cambios" : "Crear borrador"}
      action={saveStory}
      initial={initialStep}
      trigger={story ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {story ? <input type="hidden" name="id" value={story.id} /> : <SelectField label="Reserva" name="reservation" options={overview.options.reservations} searchable placeholder="Elige la reserva" />}
          <TextField label="Título" name="title" required minLength={5} maxLength={200} defaultValue={story?.title} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Ciudad" name="city" maxLength={80} defaultValue={story?.city ?? undefined} />
            <TextField label="Fotos" name="photo_count" type="number" min={0} max={60} defaultValue={story?.photo_count ?? 0} />
          </div>
          <SelectField label="Tour enlazado" name="product" options={overview.options.products} defaultValue={story?.product?.code ?? ""} clearable searchable placeholder="Sin tour enlazado" />
          <TextArea label="Frase del cliente" name="quote" rows={2} maxLength={600} defaultValue={story?.quote ?? undefined} />
          <TextArea label="Relato" name="body" rows={6} defaultValue={story?.body ?? undefined} hint="Cuente el viaje con detalles reales; mejora el SEO de la historia." />
        </>
      )}
    </PanelAction>
  );
}

function StoryDetail({ story }: { story: TravelStory }) {
  return (
    <DetailPanel label="Ver historia" title={story.title} description={`/aventuras/${story.slug}`}>
      <div className="flex flex-wrap items-center gap-2"><VitrinaBadge status={story.status} /><span className="text-[12.5px] text-fg-3">{story.city} · {story.photo_count} fotos</span></div>
      {story.quote && <blockquote className="rounded-tile border-l-4 border-brand bg-surface-2/60 px-4 py-3 text-[14px] italic">«{story.quote}»</blockquote>}
      <PanelSection title="Consentimiento (Ley 29733)">
        {story.consent ? (
          <FieldList fields={[
            { label: "Autorizó", value: story.consent.by },
            { label: "Canal", value: CHANNELS[story.consent.channel] ?? story.consent.channel },
            { label: "Fecha", value: formatDateTime(story.consent.at) },
            { label: "Nombre visible", value: NAME_MODES[story.consent.name_mode] ?? story.consent.name_mode },
            { label: "Fotos", value: story.consent.photos ? "Autorizadas" : "No autorizadas" },
            { label: "Estado", value: story.consent.valid ? <span className="text-ok">Vigente</span> : <span className="text-bad">Retirado el {formatDateTime(story.consent.revoked_at ?? "")}</span> },
          ]} />
        ) : (
          <p className="text-[13px] text-fg-2">Aún no hay consentimiento registrado.</p>
        )}
      </PanelSection>
      <PanelSection title="Ficha">
        <FieldList fields={[{ label: "Cliente", value: story.client.name }, { label: "Reserva", value: story.reservation ?? "—" }, { label: "Tour enlazado", value: story.product?.name ?? "—" }, { label: "Lecturas", value: formatNumber(story.views) }]} />
      </PanelSection>
    </DetailPanel>
  );
}

export function StoriesTable({ overview }: { overview: StoriesOverview }) {
  const columns: Column<TravelStory>[] = [
    {
      id: "title",
      header: "Historia",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-accent/10 text-accent"><Camera size={16} /></span>
          <span className="min-w-0"><b className="block truncate text-[13.5px] font-semibold">{row.title}</b><span className="text-[12px] text-fg-3">{row.city ?? "—"} · {row.photo_count} fotos</span></span>
        </span>
      ),
    },
    { id: "client", header: "Cliente y reserva", cell: (row) => <span className="text-[13px]">{row.client.name}<span className="block font-mono text-[12px] text-fg-3">{row.reservation ?? "—"}</span></span> },
    { id: "consent", header: "Consentimiento", cell: (row) => (row.consent ? <span className="flex items-center gap-1.5 text-[12.5px]"><ShieldCheck size={14} className={row.consent.valid ? "text-ok" : "text-bad"} />{row.consent.valid ? `${CHANNELS[row.consent.channel] ?? row.consent.channel} · ${NAME_MODES[row.consent.name_mode] ?? ""}` : "Retirado"}</span> : <span className="text-[12.5px] text-fg-3">Sin consentimiento</span>) },
    { id: "views", header: "Lecturas", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.views)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {row.needs_consent && row.status !== "publicado" && <QuickAction id={`av-ask-${row.id}`} label="Pedir consentimiento" title="Pedir consentimiento" description={`Enviamos a ${row.client.email ?? "el cliente"} la solicitud para autorizar la historia, elegir cómo se muestra su nombre y si se publican fotos.`} submitLabel="Enviar solicitud" action={requestConsent} fields={{ id: row.id }} icon={<Send size={13} />} />}
          {overview.can_publish && row.can_publish && <QuickAction id={`av-pub-${row.id}`} label="Publicar" title="Publicar historia" description={`Se publica en /aventuras/${row.slug} con el nombre según lo autorizado.`} submitLabel="Publicar" action={publishStory} fields={{ id: row.id }} icon={<MailCheck size={13} />} tone="ok" />}
          {overview.can_publish && row.status === "publicado" && (
            <QuickAction id={`av-unpub-${row.id}`} label="Despublicar" title="Despublicar historia" submitLabel="Despublicar" action={unpublishStory} fields={{ id: row.id }} icon={<Undo2 size={13} />} tone="mute">
              <TextArea label="Motivo" name="reason" rows={2} maxLength={300} />
            </QuickAction>
          )}
          <StoryDetail story={row} />
          <StoryFormAction story={row} overview={overview} />
          {row.status !== "publicado" && <QuickAction id={`av-del-${row.id}`} label="Eliminar" title="Eliminar historia" description={`${row.title}. Se elimina el borrador; la auditoría conserva el registro.`} submitLabel="Eliminar" action={deleteStory} fields={{ id: row.id }} row="delete" />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<TravelStory>[] = [
    { id: "published", label: "Publicadas", tone: "ok", icon: <Globe size={19} />, matches: (row) => row.status === "publicado" },
    { id: "ready", label: "Listas para publicar", tone: "t1", icon: <ShieldCheck size={19} />, matches: (row) => row.can_publish },
    { id: "consent", label: "Sin consentimiento", tone: "sun", icon: <ShieldQuestion size={19} />, matches: (row) => row.needs_consent },
  ];
  const sorts: SortOption<TravelStory>[] = [{ id: "views", label: "Lecturas", type: "number", value: (row) => row.views }];
  return <DataTable screen="canales-aventuras" rows={overview.items} columns={columns} getKey={(row) => row.id} entityLabel="historias" searchText={(row) => `${row.title} ${row.client.name} ${row.city ?? ""} ${row.reservation ?? ""}`} searchPlaceholder="Buscar historia, cliente o ciudad" metrics={metrics} sorts={sorts} emptyTitle="Aún no hay historias" />;
}
