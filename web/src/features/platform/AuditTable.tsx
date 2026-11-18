"use client";

import { Boxes, CalendarDays, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { AuditActivity, TopEntities } from "@/features/admin/Audit";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { actionMeta, type AuditEvent } from "@/lib/platformBilling";

const DAY = 86_400_000;

const limaDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(value));

const GROUPS: { id: AuditEvent["group"]; label: string }[] = [
  { id: "agencias", label: "Agencias" },
  { id: "facturacion", label: "Facturación" },
  { id: "catalogo", label: "Planes y funcionalidades" },
  { id: "tareas", label: "Tareas" },
  { id: "sesiones", label: "Sesiones y accesos" },
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
  {
    id: "subject",
    header: "Sobre",
    cell: (event) => (
      <span className="min-w-0">
        <Link href={`/plataforma/auditoria/${event.id}`} className="block text-[13.5px] font-semibold hover:underline">
          {event.subject}
        </Link>
        {event.tenant && event.entity !== "Tenant" && (
          <Link href={`/plataforma/agencias/${event.tenant.code}`} className="block truncate text-xs text-fg-3 hover:underline">
            {event.tenant.name}
          </Link>
        )}
      </span>
    ),
  },
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
  {
    id: "view",
    header: "",
    align: "right",
    mobile: "detail",
    cell: (event) => (
      <RowActions>
        <RowIcon tone="view" label="Ver el evento" href={`/plataforma/auditoria/${event.id}`} />
      </RowActions>
    ),
  },
];

const sorts: SortOption<AuditEvent>[] = [{ id: "at", label: "Fecha", type: "date", value: (event) => event.at }];

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function AuditTable({ events }: { events: AuditEvent[] }) {
  const [today] = useState(() => Date.now());
  const counts = new Map<string, number>();
  for (const event of events) counts.set(limaDay(event.at), (counts.get(limaDay(event.at)) ?? 0) + 1);
  const daily = Array.from({ length: 14 }, (_, index) => {
    const date = limaDay(new Date(today - (13 - index) * DAY));
    return { date, total: counts.get(date) ?? 0 };
  });
  const peak = daily.reduce<(typeof daily)[number] | null>((best, day) => (day.total > (best?.total ?? 0) ? day : best), null);
  const entities = new Map<string, number>();
  for (const event of events) entities.set(event.entity, (entities.get(event.entity) ?? 0) + 1);
  const top = [...entities.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  const critical = events.filter((event) => event.critical).length;
  const actors = new Set(events.map((event) => event.actor ?? "Sistema")).size;
  const metrics: MetricFilter<AuditEvent>[] = [
    { id: "critical", label: "Críticos", tone: "bad", icon: <ShieldAlert size={19} />, note: `${events.length > 0 ? `${Math.round((critical / events.length) * 100)} % de ` : ""}${formatNumber(events.length)} eventos · ${formatNumber(actors)} ${actors === 1 ? "persona o proceso" : "personas y procesos"}`, info: <p>Suspensiones, cambios de plan, anulaciones, accesos denegados y demás acciones marcadas como críticas al registrarse; la nota compara con los eventos de la tabla (los 500 más recientes) y cuenta quiénes los dejaron. Al presionarla ves solo los críticos.</p>, matches: (event) => event.critical },
    {
      id: "peak",
      label: "Día de más actividad",
      tone: "violet",
      icon: <CalendarDays size={19} />,
      display: peak ? formatDate(peak.date) : "Sin eventos",
      note: peak ? `${formatNumber(peak.total)} eventos · últimas 2 semanas` : undefined,
      info: (
        <>
          <p className="mb-2">Eventos registrados por día en las últimas dos semanas, en hora de Lima. Al presionarla ves los eventos del día con más actividad.</p>
          <div className="w-[270px]">
            <AuditActivity daily={daily} />
          </div>
        </>
      ),
      matches: (event) => peak !== null && limaDay(event.at) === peak.date,
    },
    {
      id: "top",
      label: "Lo más registrado",
      tone: "sun",
      icon: <Boxes size={19} />,
      display: top[0]?.label ?? "Sin eventos",
      note: top[0] && events.length > 0 ? `${Math.round((top[0].total / events.length) * 100)} % de los eventos` : undefined,
      info: (
        <>
          <p className="mb-2">Tipos de registro con más eventos. Al presionarla ves los eventos del primero.</p>
          <div className="w-[270px]">
            <TopEntities items={top} total={events.length} />
          </div>
        </>
      ),
      matches: (event) => top[0] !== undefined && event.entity === top[0].label,
    },
  ];
  const filters: FilterConfig<AuditEvent>[] = [
    { id: "group", label: "Área", options: GROUPS.map((group) => ({ value: group.id, label: group.label })), value: (event) => event.group },
    { id: "action", label: "Acción", options: unique(events.map((event) => actionMeta(event.action).label)), value: (event) => actionMeta(event.action).label },
    { id: "tenant", label: "Agencia", options: unique(events.flatMap((event) => (event.tenant ? [event.tenant.name] : []))), value: (event) => event.tenant?.name ?? "" },
    { id: "actor", label: "Quién", options: unique(events.map((event) => event.actor ?? "Sistema")), value: (event) => event.actor ?? "Sistema" },
    { id: "critical", label: "Criticidad", options: [{ value: "1", label: "Solo críticas" }, { value: "0", label: "No críticas" }], value: (event) => (event.critical ? "1" : "0") },
  ];

  return <DataTable screen="plataforma-auditoria" rows={events} columns={columns} getKey={(event) => event.id} entityLabel="eventos" searchText={(event) => `${event.subject} ${event.entity_id} ${event.tenant?.name ?? ""} ${event.after ?? ""} ${event.before ?? ""} ${event.actor ?? ""}`} searchPlaceholder="Buscar agencia, factura o detalle" metrics={metrics} filters={filters} sorts={sorts} />;
}
