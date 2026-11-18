"use client";

import { AlertTriangle, Copy, RefreshCw, Send, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { retryDispatch } from "@/app/(backoffice)/canales/seguimiento/actions";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { DISPATCH_STATUS, type Dispatch, type TrackingOverview } from "@/lib/tracking";
import { Hidden, initialStep, ProviderChip } from "./TrackingUi";

export function DispatchesTable({ rows, canManage, kpis }: { rows: Dispatch[]; canManage: boolean; kpis: TrackingOverview["kpis"] }) {
  const columns: Column<Dispatch>[] = [
    { id: "at", header: "Fecha", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDateTime(row.occurred_at)}</span> },
    { id: "event", header: "Evento", mobile: "title", cell: (row) => <b className="text-[13.5px] font-semibold">{row.event_label}</b> },
    {
      id: "target",
      header: "Destino",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <ProviderChip provider={row.provider} label={row.tag_name} />
          <span className="font-mono text-[11.5px] text-fg-3">{row.provider_event}</span>
        </span>
      ),
    },
    { id: "channel", header: "Canal", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.channel === "servidor" ? "Servidor" : "Navegador"}</span> },
    { id: "value", header: "Valor", align: "right", cell: (row) => <span className="tabular-nums">{row.value !== null ? formatMoney(row.value, row.currency ?? "PEN") : "—"}</span> },
    { id: "ref", header: "Referencia", wideOnly: true, cell: (row) => <span className="font-mono text-[12px]">{row.reference ?? "—"}</span> },
    {
      id: "status",
      header: "Estado",
      mobile: "detail",
      cell: (row) => (
        <span className="flex max-w-[260px] flex-col gap-1">
          <Badge tone={DISPATCH_STATUS[row.status].tone}>{DISPATCH_STATUS[row.status].label}</Badge>
          {row.error && <span className="text-[11.5px] text-fg-3">{row.error}</span>}
          <span className="text-[11px] text-fg-3">
            {row.attempts} {row.attempts === 1 ? "intento" : "intentos"}
            {row.http_status ? ` · HTTP ${row.http_status}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        canManage && row.retryable ? (
          <RowActions>
            <PanelAction<StepResult> label="Reintentar" formId={`retry-${row.id}`} title="Reintentar envío" description={`Se vuelve a enviar a ${row.tag_name} con el mismo event_id; el proveedor lo cuenta una sola vez.`} submitLabel="Reintentar" action={retryDispatch} initial={initialStep} trigger={(open) => <RowIcon tone="view" label="Reintentar" icon={<RefreshCw size={15} />} onClick={open} />}>
              {() => <Hidden values={{ id: row.id }} />}
            </PanelAction>
          </RowActions>
        ) : null,
    },
  ];
  const card = (status: "enviado" | "fallido" | "sin_consentimiento" | "duplicado", icon: ReactNode, info: string, note?: string): MetricFilter<Dispatch> => ({ id: status, label: DISPATCH_STATUS[status].label, tone: DISPATCH_STATUS[status].tone, icon, note, info: <p>{info} Al presionarla, la tabla muestra solo esos envíos.</p>, matches: (row: Dispatch) => row.status === status });
  const metrics: MetricFilter<Dispatch>[] = [
    card("enviado", <Send size={19} />, "Envíos aceptados por los proveedores, según el registro de envíos; la nota cuenta los de las últimas 24 horas y los que el proveedor deduplicó por event_id.", `${formatNumber(kpis.sent_24h)} en 24 h · ${formatNumber(kpis.deduplicated_24h)} deduplicadas`),
    card("fallido", <AlertTriangle size={19} />, "Envíos con error. Los que todavía se pueden reintentar (hasta 10 intentos) se reintentan con el mismo event_id; se guardan 90 días.", `${formatNumber(kpis.failed)} se pueden reintentar`),
    card("sin_consentimiento", <ShieldOff size={19} />, "Conversiones que no se enviaron porque el visitante no aceptó la categoría de cookies de esa etiqueta."),
    card("duplicado", <Copy size={19} />, "Conversiones que ya se habían enviado con el mismo event_id; el proveedor las cuenta una sola vez."),
  ];
  const filters: FilterConfig<Dispatch>[] = [
    { id: "provider", label: "Proveedor", options: [...new Map(rows.map((row) => [row.provider, row.tag_name])).entries()].map(([value, label]) => ({ value, label })), value: (row) => row.provider },
    { id: "channel", label: "Canal", options: [{ value: "servidor", label: "Servidor" }, { value: "navegador", label: "Navegador" }], value: (row) => row.channel },
  ];
  const sorts: SortOption<Dispatch>[] = [{ id: "at", label: "Fecha", type: "date", value: (row) => row.occurred_at }];

  return <DataTable screen="seguimiento-envios" rows={rows} columns={columns} getKey={(row) => String(row.id)} entityLabel="envíos" searchText={(row) => `${row.event_label} ${row.tag_name} ${row.reference ?? ""} ${row.event_id}`} searchPlaceholder="Buscar evento, destino o referencia" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay envíos de conversiones" />;
}
