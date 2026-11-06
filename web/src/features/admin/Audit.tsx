"use client";

import { Ban, CalendarDays, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/ui/Charts";
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

export function AuditTable({ data }: { data: AuditOverview }) {
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
  return <DataTable screen="admin-auditoria" rows={data.events} columns={columns} getKey={(event) => String(event.code)} entityLabel="eventos" searchText={(event) => `${event.entity} ${event.entity_id} ${event.action} ${event.actor} ${event.before ?? ""} ${event.after ?? ""} ${event.ip ?? ""}`} searchPlaceholder="Buscar documento, usuario o valor" metrics={metrics} filters={filters} sorts={sorts} />;
}

export function AuditActivity({ daily }: { daily: AuditOverview["daily"] }) {
  const last = daily.slice(-14);
  return (
    <BarChart
      height={110}
      data={last.map((day, index) => ({
        label: formatDate(day.date).split(" ")[0],
        value: day.total,
        caption: String(day.total),
        detail: `${formatDate(day.date)}: ${day.total} eventos`,
        highlight: index === last.length - 1,
      }))}
    />
  );
}

export function TopEntities({ items, total }: { items: AuditOverview["top_entities"]; total: number }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => {
        const pct = total > 0 ? (item.total / total) * 100 : 0;
        return (
          <li key={item.label} className="group" title={`${item.total} eventos (${pct.toFixed(0)} %)`}>
            <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
              <span className="font-semibold">{item.label}</span>
              <span className="font-mono text-fg-3">{item.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full origin-left rounded-full bg-accent transition-[filter] duration-200 group-hover:brightness-125 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(pct, 3)}%`, animationDelay: `${index * 80}ms` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
