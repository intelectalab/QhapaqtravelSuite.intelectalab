"use client";

import { Building2, KeyRound, Layers, ReceiptText, ServerCog } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { actionMeta, type AuditEvent } from "@/lib/platformBilling";
import type { Tone } from "@/lib/tone";

const GROUPS: { id: AuditEvent["group"]; label: string; tone: Tone; icon: React.ReactNode }[] = [
  { id: "agencias", label: "Agencias", tone: "t1", icon: <Building2 size={19} /> },
  { id: "facturacion", label: "Facturación", tone: "ok", icon: <ReceiptText size={19} /> },
  { id: "catalogo", label: "Planes y funcionalidades", tone: "violet", icon: <Layers size={19} /> },
  { id: "tareas", label: "Tareas", tone: "t4", icon: <ServerCog size={19} /> },
  { id: "sesiones", label: "Sesiones y accesos", tone: "info", icon: <KeyRound size={19} /> },
];

const detail = (event: AuditEvent) => {
  if (event.before && event.after) return `${event.before} → ${event.after}`;
  return event.after ?? event.before ?? "";
};

const columns: Column<AuditEvent>[] = [
  {
    id: "action",
    header: "Acción",
    mobile: "title",
    cell: (event) => (
      <span className="flex flex-col items-start gap-1">
        <Badge tone={actionMeta(event.action).tone}>{actionMeta(event.action).label}</Badge>
        <small className="text-xs text-fg-3">{event.entity}</small>
      </span>
    ),
  },
  { id: "subject", header: "Sobre", cell: (event) => <span className="text-[13.5px] font-semibold">{event.subject}</span> },
  { id: "detail", header: "Detalle", wideOnly: true, cell: (event) => <span className="line-clamp-2 max-w-[420px] text-[13px] text-fg-2" title={detail(event)}>{detail(event)}</span> },
  {
    id: "actor",
    header: "Quién",
    mobile: "detail",
    cell: (event) => (
      <span className="flex items-center gap-2">
        <Avatar name={event.actor ?? "Sistema"} />
        <span className="min-w-0">
          <b className="block truncate text-[13px] font-semibold">{event.actor ?? "Sistema"}</b>
          {event.ip && <small className="block font-mono text-[11.5px] text-fg-3">{event.ip}</small>}
        </span>
      </span>
    ),
  },
  {
    id: "at",
    header: "Cuándo",
    align: "right",
    cell: (event) => (
      <span className="text-[12.5px] text-fg-2">
        {formatDateTime(event.at)}
        {event.critical && (
          <Badge tone="bad" dot={false} className="ml-2">
            Crítica
          </Badge>
        )}
      </span>
    ),
  },
];

const metrics: MetricFilter<AuditEvent>[] = GROUPS.map((group) => ({ id: group.id, label: group.label, tone: group.tone, icon: group.icon, matches: (event: AuditEvent) => event.group === group.id }));

const sorts: SortOption<AuditEvent>[] = [{ id: "at", label: "Fecha", type: "date", value: (event) => event.at }];

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function AuditTable({ events }: { events: AuditEvent[] }) {
  const filters: FilterConfig<AuditEvent>[] = [
    { id: "action", label: "Acción", options: unique(events.map((event) => actionMeta(event.action).label)), value: (event) => actionMeta(event.action).label },
    { id: "actor", label: "Quién", options: unique(events.map((event) => event.actor ?? "Sistema")), value: (event) => event.actor ?? "Sistema" },
    { id: "critical", label: "Criticidad", options: [{ value: "1", label: "Solo críticas" }, { value: "0", label: "No críticas" }], value: (event) => (event.critical ? "1" : "0") },
  ];

  return <DataTable screen="plataforma-auditoria" rows={events} columns={columns} getKey={(event) => event.id} entityLabel="eventos" searchText={(event) => `${event.subject} ${event.entity_id} ${event.after ?? ""} ${event.before ?? ""} ${event.actor ?? ""}`} searchPlaceholder="Buscar agencia, factura o detalle" metrics={metrics} filters={filters} sorts={sorts} />;
}
