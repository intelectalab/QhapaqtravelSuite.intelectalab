"use client";

import { Check, Pause, Play, Plus, RefreshCw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { CONSENT_LABEL, SITE_LABEL, type TrackingProvider, type TrackingTag } from "@/lib/tracking";
import { Hidden, ProviderChip, TagFields, TagStatusBadge, VerifyCell } from "./TrackingUi";

type Action<S extends PanelActionState> = (state: S, form: FormData) => Promise<S>;

export interface TagActions<S extends PanelActionState> {
  create: Action<S>;
  update: Action<S>;
  act: Action<S>;
  initial: S;
}

interface TagsTableProps<S extends PanelActionState> {
  screen: string;
  rows: TrackingTag[];
  providers: TrackingProvider[];
  canManage: boolean;
  canApprove: boolean;
  me: string;
  selfApprovalBlocked: boolean;
  actions: TagActions<S>;
  platform?: boolean;
}

function ActButton<S extends PanelActionState>({ tag, action, values, label, title, description, icon, tone = "neutral", act, initial, withReason = false }: { tag: TrackingTag; action: string; values?: Record<string, string>; label: string; title: string; description: string; icon: ReactNode; tone?: "view" | "edit" | "delete" | "neutral"; act: Action<S>; initial: S; withReason?: boolean }) {
  return (
    <PanelAction<S>
      label={label}
      formId={`tag-${action}-${tag.code}-${values?.decision ?? ""}`}
      title={title}
      description={description}
      submitLabel={label}
      action={act}
      initial={initial}
      trigger={(open) => <RowIcon tone={tone} label={label} icon={icon} onClick={open} />}
    >
      {() => (
        <>
          <Hidden values={{ code: tag.code, action, lock_version: tag.lock_version, ...(values ?? {}) }} />
          {withReason && <TextArea label="Motivo" name="reason" required minLength={10} rows={3} placeholder="Explica qué debe corregirse (10 caracteres o más)." />}
        </>
      )}
    </PanelAction>
  );
}

export function TagsTable<S extends PanelActionState>({ screen, rows, providers, canManage, canApprove, me, selfApprovalBlocked, actions, platform = false }: TagsTableProps<S>) {
  const columns: Column<TrackingTag>[] = [
    { id: "provider", header: "Proveedor", cell: (row) => <ProviderChip provider={row.provider} label={row.provider_short} /> },
    {
      id: "name",
      header: "Nombre e ID",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.name}</b>
          <span className="font-mono text-[12px] text-fg-3">{row.measurement_id ?? row.script_src ?? "Código en línea"}</span>
        </span>
      ),
    },
    ...(platform ? [{ id: "site", header: "Sitio", cell: (row: TrackingTag) => <span className="text-[13px]">{SITE_LABEL[row.site ?? "ambos"]}</span> }] : []),
    { id: "consent", header: "Cookies", wideOnly: true, cell: (row) => <span className="text-[13px]">{CONSENT_LABEL[row.consent_category]}</span> },
    {
      id: "pages",
      header: "Páginas",
      wideOnly: true,
      cell: (row) => (
        <span className="flex flex-col font-mono text-[12px]">
          {row.pages}
          {row.exclude && <span className="text-fg-3">sin {row.exclude}</span>}
        </span>
      ),
    },
    { id: "server", header: "Del servidor", wideOnly: true, cell: (row) => (row.server_label ? <span className="text-[12.5px]">{row.server_side ? row.server_label : <span className="text-fg-3">No</span>}</span> : <span className="text-fg-3">—</span>) },
    { id: "verify", header: "Verificación", cell: (row) => <VerifyCell tag={row} /> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <TagStatusBadge status={row.status} pending={row.pending_revision !== null} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => {
        const reviewable = row.status === "en_revision" || row.pending_revision !== null;
        const author = row.pending_revision?.author ?? row.created_by;
        const own = author === me && (platform || selfApprovalBlocked);
        return (
          <RowActions>
            {canManage && !platform && row.status === "activo" && <ActButton tag={row} action="verify" label="Verificar" title="Verificar instalación" description={`Abrimos el sitio, aceptamos cookies y confirmamos que ${row.provider_short} carga y envía page_view.`} icon={<RefreshCw size={15} />} tone="view" act={actions.act} initial={actions.initial} />}
            {canManage && ["activo", "pausado"].includes(row.status) && <ActButton tag={row} action="pause" values={{ status: row.status }} label={row.status === "activo" ? "Pausar" : "Reanudar"} title={row.status === "activo" ? "Pausar etiqueta" : "Reanudar etiqueta"} description={row.status === "activo" ? "Deja de cargar en el sitio en menos de 1 minuto." : "Vuelve a cargar en el sitio en menos de 1 minuto."} icon={row.status === "activo" ? <Pause size={15} /> : <Play size={15} />} act={actions.act} initial={actions.initial} />}
            {canManage && platform && ["borrador", "rechazado"].includes(row.status) && <ActButton tag={row} action="submit" label="Enviar a revisión" title="Enviar a revisión" description="Otro Super Admin debe aprobarla antes de que cargue en la vitrina." icon={<Send size={15} />} tone="view" act={actions.act} initial={actions.initial} />}
            {canApprove && reviewable && (own ? <RowIcon tone="neutral" label="La aprueba otra persona" icon={<ShieldCheck size={15} />} disabledHint="La aprueba otra persona con permiso de aprobación" /> : (
              <>
                <ActButton tag={row} action="decision" values={{ decision: "aprobar" }} label="Aprobar" title="Aprobar" description={row.pending_revision ? "El cambio reemplaza la versión activa." : "La etiqueta empieza a cargar en menos de 1 minuto."} icon={<Check size={15} />} tone="view" act={actions.act} initial={actions.initial} />
                <ActButton tag={row} action="decision" values={{ decision: "rechazar" }} label="Rechazar" title="Rechazar" description="Quien la creó verá el motivo y podrá corregirla." icon={<X size={15} />} tone="delete" act={actions.act} initial={actions.initial} withReason />
              </>
            ))}
            {canManage && (
              <PanelAction<S> label="Editar" formId={`tag-edit-${row.code}`} title={`Editar ${row.name}`} description="Los cambios se aplican en menos de 1 minuto y quedan auditados." submitLabel="Guardar" action={actions.update} initial={actions.initial} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
                {() => (
                  <>
                    <Hidden values={{ code: row.code, lock_version: row.lock_version }} />
                    <TagFields providers={providers} tag={row} />
                  </>
                )}
              </PanelAction>
            )}
            {canManage && !platform && <ActButton tag={row} action="delete" label="Eliminar" title="Eliminar etiqueta" description={`${row.name} deja de cargar y sus envíos de conversiones se desactivan. El historial se conserva.`} icon={<Trash2 size={15} />} tone="delete" act={actions.act} initial={actions.initial} />}
          </RowActions>
        );
      },
    },
  ];
  const metrics: MetricFilter<TrackingTag>[] = [
    { id: "active", label: "Activas", tone: "ok", matches: (row) => row.status === "activo" },
    { id: "paused", label: "Pausadas o borrador", tone: "mute", matches: (row) => ["pausado", "borrador"].includes(row.status) },
    { id: "review", label: "Por revisar", tone: "warn", matches: (row) => row.status === "en_revision" || row.pending_revision !== null },
    { id: "unverified", label: "Sin verificar", tone: "info", matches: (row) => row.status === "activo" && row.verify_result !== "ok" },
  ];
  const filters: FilterConfig<TrackingTag>[] = [{ id: "provider", label: "Proveedor", options: [...new Map(rows.map((row) => [row.provider, row.provider_name])).entries()].map(([value, label]) => ({ value, label })), value: (row) => row.provider }];

  return (
    <DataTable
      screen={screen}
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="etiquetas"
      searchText={(row) => `${row.name} ${row.measurement_id ?? ""} ${row.provider_name}`}
      searchPlaceholder="Buscar etiqueta o ID"
      metrics={metrics}
      filters={filters}
      emptyTitle="Aún no hay etiquetas"
      toolbarEnd={
        canManage ? (
          <PanelAction<S> label="Nueva etiqueta" icon={<Plus size={16} strokeWidth={2.4} />} size="sm" formId={`${screen}-new`} title="Nueva etiqueta" description={platform ? "Nace en borrador; otro Super Admin la aprueba antes de cargar." : "Se activa al guardarla. El código lo genera KipuControl con el ID; no pegues el código del proveedor."} submitLabel={platform ? "Crear borrador" : "Crear y activar"} action={actions.create} initial={actions.initial}>
            {() => <TagFields providers={providers} withSite={platform} />}
          </PanelAction>
        ) : undefined
      }
    />
  );
}
