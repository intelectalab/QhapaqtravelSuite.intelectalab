"use client";

import { CircleCheck, FileText, Hourglass, TimerOff } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { OPEN_QUOTE, paxLabel, type QuoteRow } from "@/lib/quotes";
import { statusLabel } from "@/lib/tone";
import { QuoteDeleteAction } from "./QuoteActions";

const href = (row: QuoteRow) => `/cotizaciones/${row.code}`;

export function QuotesTable({ rows, canManage }: { rows: QuoteRow[]; canManage: boolean }) {
  const showMargin = rows.some((row) => row.margin_pct !== null);

  const columns: Column<QuoteRow>[] = [
    {
      id: "quote",
      header: "Cotización",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={href(row)} className="font-semibold hover:underline">
            {row.title}
          </Link>
          <small className="block text-xs text-fg-3">
            {row.code} · v{row.version} · {row.client.name}
          </small>
        </div>
      ),
    },
    {
      id: "trip",
      header: "Viaje",
      cell: (row) => (
        <span className="text-[13px]">
          {formatDate(row.travel_from).replace(/ \d{4}$/, "")} al {formatDate(row.travel_to)}
          <span className="block text-xs text-fg-3">{paxLabel(row.pax)}</span>
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (row) => (
        <span className="font-mono text-[13px] font-semibold">
          {formatMoney(row.total, row.currency)}
          {row.margin_pct !== null && <span className={cn("block text-[11.5px] font-medium", Number(row.margin_pct) < 15 ? "text-warn" : "text-ok")}>{row.margin_pct} % de margen</span>}
        </span>
      ),
    },
    {
      id: "valid",
      header: "Vigencia",
      wideOnly: true,
      cell: (row) =>
        row.days_left === null ? (
          <span className="text-[12.5px] text-fg-3">—</span>
        ) : (
          <span className={cn("text-[12.5px]", row.days_left < 0 ? "text-bad" : row.days_left <= 3 ? "font-semibold text-warn" : "text-fg-2")}>
            {row.days_left < 0 ? "Venció" : row.days_left === 0 ? "Vence hoy" : `${row.days_left} ${row.days_left === 1 ? "día" : "días"}`}
            <span className="block text-xs text-fg-3">hasta el {formatDate(row.valid_until)}</span>
          </span>
        ),
    },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver cotización" href={href(row)} />
          {canManage && (
            <>
              <RowIcon tone="edit" label="Editar" href={`${href(row)}/editar`} disabledHint={row.status === "borrador" ? undefined : "Ya se envió: crea una nueva versión desde la ficha"} />
              {["aprobada", "convertida"].includes(row.status) ? <RowIcon tone="delete" label="Eliminar" disabledHint="Aprobada o en reserva: no se elimina" /> : <QuoteDeleteAction code={row.code} title={row.title} iconOnly />}
            </>
          )}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<QuoteRow>[] = [
    { id: "open", label: "En curso", tone: "t1", icon: <FileText size={19} />, matches: (row) => OPEN_QUOTE.includes(row.status) },
    { id: "expiring", label: "Vencen en 3 días", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.days_left !== null && row.days_left >= 0 && row.days_left <= 3 },
    { id: "won", label: "Aprobadas o en reserva", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => ["aprobada", "convertida"].includes(row.status) },
    { id: "lost", label: "Rechazadas o vencidas", tone: "bad", icon: <TimerOff size={19} />, matches: (row) => ["rechazada", "vencida"].includes(row.status) },
  ];

  const filters: FilterConfig<QuoteRow>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "owner", label: "Asesor", options: [...new Set(rows.map((row) => row.owner.name))].map((value) => ({ value, label: value })), value: (row) => row.owner.name },
  ];

  const sorts: SortOption<QuoteRow>[] = [
    { id: "created", label: "Más recientes", type: "date", value: (row) => row.created_at },
    { id: "valid", label: "Vigencia", type: "date", value: (row) => row.valid_until },
    { id: "total", label: "Total en soles", type: "number", value: (row) => Number(row.total_pen) },
    ...(showMargin ? [{ id: "margin", label: "Margen", type: "number" as const, value: (row: QuoteRow) => (row.margin_pct === null ? null : Number(row.margin_pct)) }] : []),
  ];

  return (
    <DataTable
      screen="cotizaciones"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="cotizaciones"
      searchText={(row) => `${row.code} ${row.title} ${row.client.name}`}
      searchPlaceholder="Buscar cotización o cliente"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
