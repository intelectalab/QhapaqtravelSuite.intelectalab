"use client";

import { Ban, CalendarDays, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { actionLabel, type AuditEntry, type AuditOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, TIME_ZONE } from "@/lib/format";

const limaDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
const isToday = (iso: string) => limaDay(new Date(iso)) === limaDay(new Date());

export function AuditChange({ before, after, compact = false }: { before: string | null; after: string | null; compact?: boolean }) {
  if (!before && !after) return <span className="text-[12.5px] text-fg-3">—</span>;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[12.5px]", compact && "max-w-[300px]")} title={`${before ?? "—"} → ${after ?? "—"}`}>
      {before && <span className="truncate rounded-md bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-1.5 py-0.5 text-fg-2 line-through decoration-bad/40">{before}</span>}
      {before && after && <span className="flex-none text-fg-3">→</span>}
      {after && <span className="truncate rounded-md bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-1.5 py-0.5 text-fg">{after}</span>}
    </span>
  );
}

export function AuditTable({ data, initialSearch }: { data: AuditOverview; initialSearch?: string }) {
  const columns: Column<AuditEntry>[] = [
    {
      id: "event",
      header: "Evento",
      mobile: "title",
      cell: (event) => (
        <Link href={`/admin/auditoria/${event.code}`} className="group/event block min-w-0">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold group-hover/event:text-accent">
            {actionLabel(event.action)}
            {event.critical && <Badge tone="bad">Crítico</Badge>}
          </p>
          <p className="truncate text-[11.5px] text-fg-3">
            {event.entity} · <span className="font-mono">{event.entity_id}</span>
          </p>
        </Link>
      ),
    },
    {
      id: "actor",
      header: "Quién",
      cell: (event) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={event.actor} size="sm" />
          <span className="min-w-0">
            <b className="block truncate text-[13px] font-semibold">{event.actor}</b>
            {event.role && <span className="text-[11.5px] text-fg-3">{event.role}</span>}
          </span>
        </span>
      ),
    },
    { id: "change", header: "Antes y después", wideOnly: true, cell: (event) => <AuditChange before={event.before} after={event.after} compact /> },
    { id: "at", header: "Fecha", cell: (event) => <span className="whitespace-nowrap text-[12.5px] text-fg-3">{formatDateTime(event.at, false)}</span> },
    { id: "ip", header: "IP", wideOnly: true, cell: (event) => <span className="font-mono text-[12px] text-fg-3">{event.ip ?? "—"}</span> },
    {
      id: "correlation",
      header: "Correlación",
      wideOnly: true,
      cell: (event) =>
        event.correlation ? (
          <Link href={`/admin/auditoria/${event.code}`} title={`Operación ${event.correlation}: abre el evento para ver los relacionados`} className="font-mono text-[12px] text-fg-3 hover:text-accent">
            {event.correlation.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (event) => (
        <RowActions>
          <RowIcon tone="view" label="Ver detalle" href={`/admin/auditoria/${event.code}`} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<AuditEntry>[] = [
    { id: "critical", label: "Críticos", tone: "bad", icon: <ShieldAlert size={19} />, matches: (event) => event.critical },
    { id: "denied", label: "Accesos denegados", tone: "warn", icon: <Ban size={19} />, matches: (event) => event.action.includes("denegad") },
    { id: "today", label: "Hoy", tone: "t1", icon: <CalendarDays size={19} />, matches: (event) => isToday(event.at) },
  ];
  const unique = (pick: (event: AuditEntry) => string, format: (value: string) => string = (value) => value) =>
    [...new Set(data.events.map(pick))].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: format(value) }));
  const filters: FilterConfig<AuditEntry>[] = [
    { id: "entity", label: "Entidad", options: unique((event) => event.entity), value: (event) => event.entity },
    { id: "action", label: "Acción", options: unique((event) => event.action, actionLabel), value: (event) => event.action },
    { id: "actor", label: "Usuario", options: unique((event) => event.actor), value: (event) => event.actor },
  ];
  const sorts: SortOption<AuditEntry>[] = [
    { id: "at", label: "Fecha", type: "date", value: (event) => event.at },
    { id: "actor", label: "Usuario", value: (event) => event.actor },
  ];
  const csv = {
    fileName: "auditoria",
    columns: [
      { header: "Código", value: (event: AuditEntry) => event.code },
      { header: "Fecha", value: (event: AuditEntry) => event.at, type: "datetime" as const },
      { header: "Usuario", value: (event: AuditEntry) => event.actor },
      { header: "Rol", value: (event: AuditEntry) => event.role },
      { header: "Entidad", value: (event: AuditEntry) => event.entity },
      { header: "Registro", value: (event: AuditEntry) => event.entity_id },
      { header: "Acción", value: (event: AuditEntry) => actionLabel(event.action) },
      { header: "Crítico", value: (event: AuditEntry) => event.critical },
      { header: "Antes", value: (event: AuditEntry) => event.before },
      { header: "Después", value: (event: AuditEntry) => event.after },
      { header: "IP", value: (event: AuditEntry) => event.ip },
      { header: "Correlación", value: (event: AuditEntry) => event.correlation },
    ],
  };
  return <DataTable screen="admin-auditoria" initialSearch={initialSearch} rows={data.events} columns={columns} getKey={(event) => String(event.code)} entityLabel="eventos" searchText={(event) => `${event.entity} ${event.entity_id} ${event.action} ${event.actor} ${event.before ?? ""} ${event.after ?? ""} ${event.ip ?? ""} ${event.correlation ?? ""}`} searchPlaceholder="Buscar documento, usuario, IP o valor" metrics={metrics} filters={filters} sorts={sorts} csv={csv} />;
}

export function AuditActivity({ daily }: { daily: AuditOverview["daily"] }) {
  const last = daily.slice(-14);
  return (
    <div>
      <Sparkline values={last.map((day) => day.total)} labels={last.map((day) => `${formatDate(day.date)}: ${day.total} eventos`)} className="h-14 text-t1" />
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-fg-3">
        <span>{last[0] ? formatDate(last[0].date) : ""}</span>
        <span>{last.at(-1) ? formatDate(last.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

export function TopEntities({ items, total, format = (value) => value, href, barClass = "bg-accent" }: { items: AuditOverview["top_entities"]; total: number; format?: (label: string) => string; href?: (label: string) => string; barClass?: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => {
        const pct = total > 0 ? (item.total / total) * 100 : 0;
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
              <span className="truncate font-semibold group-hover:text-accent">{format(item.label)}</span>
              <span className="font-mono text-fg-3">{item.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full origin-left rounded-full transition-[filter] duration-200 group-hover:brightness-125 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]", barClass)} style={{ width: `${Math.max(pct, 3)}%`, animationDelay: `${index * 80}ms` }} />
            </div>
          </>
        );
        return (
          <li key={item.label} className="group" title={`${item.total} eventos (${pct.toFixed(0)} %)`}>
            {href ? <Link href={href(item.label)} className="block">{body}</Link> : body}
          </li>
        );
      })}
    </ul>
  );
}

const ACTOR_TYPES: Record<string, string> = { system: "Sistema", platform_user: "Plataforma", api_client: "Integración por API" };

export function AuditBreakdown({ data, days }: { data: AuditOverview; days: number }) {
  const critical = data.critical_by_action ?? [];
  const actors = data.by_actor ?? [];
  const criticalTotal = critical.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-2">
      <Card className="lift">
        <TintCardTitle icon={ShieldAlert} title="Acciones críticas por tipo" tone="bad" aside={<InfoTip label="De dónde sale">Eventos marcados como críticos en el periodo elegido, agrupados por acción: inicios de sesión, cambios de permisos, anulaciones, descuentos y exportaciones.</InfoTip>} />
        {critical.length === 0 ? <p className="text-[13px] text-fg-3">Sin eventos críticos en el periodo.</p> : <TopEntities items={critical} total={criticalTotal} format={actionLabel} barClass="bg-bad" href={(action) => `/admin/auditoria?periodo=${days}&q=${encodeURIComponent(action)}`} />}
      </Card>
      <Card className="lift">
        <TintCardTitle icon={Users} title="Actividad por actor" tone="t4" aside={<InfoTip label="De dónde sale">Personas, integraciones y procesos con más eventos en el periodo elegido. Toca uno para ver sus eventos.</InfoTip>} />
        {actors.length === 0 ? <p className="text-[13px] text-fg-3">Sin actividad en el periodo.</p> : <TopEntities items={actors} total={data.kpis.total} format={(label) => ACTOR_TYPES[label] ?? label} barClass="bg-[var(--t4)]" href={(actor) => `/admin/auditoria?periodo=${days}&q=${encodeURIComponent(ACTOR_TYPES[actor] ?? actor)}`} />}
      </Card>
    </div>
  );
}
