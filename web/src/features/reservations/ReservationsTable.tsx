"use client";

import { Ban, CircleCheck, Plane, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { CLOSED_RESERVATION, type ReservationRow } from "@/lib/reservations";
import { statusLabel } from "@/lib/tone";

const href = (row: ReservationRow) => `/reservas/${row.code}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

export function ReservationsTable({ rows, today, can, prices = true }: { rows: ReservationRow[]; today: string; can: { modify: boolean; cancel: boolean }; prices?: boolean }) {
  const traveling = (row: ReservationRow) => row.travel_from <= today && row.travel_to >= today && row.status !== "cancelada";

  const columns: Column<ReservationRow>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={href(row)} className="font-semibold hover:underline">
            {row.title}
          </Link>
          {traveling(row) && (
            <span className="ml-2">
              <LiveTag>De viaje</LiveTag>
            </span>
          )}
          <small className="block text-xs text-fg-3">
            {row.code} · {row.client.name}
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
          <span className="block text-xs text-fg-3">{row.passengers === 1 ? "1 pasajero" : `${row.passengers} pasajeros`}</span>
        </span>
      ),
    },
    { id: "total", header: "Total", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.total ?? 0, row.currency)}</span> },
    {
      id: "balance",
      header: "Por cobrar",
      align: "right",
      cell: (row) => ((row.balance_pen ?? 0) > 0 ? <span className="font-mono text-[13px] text-bad">{formatMoney(row.balance_pen ?? 0)}</span> : <span className="text-[12.5px] text-ok">Pagado</span>),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {row.open_incidents > 0 && <TriangleAlert size={15} className="text-bad" aria-label="Incidencia abierta" />}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => {
        const closed = CLOSED_RESERVATION.includes(row.status);
        const hint = row.status === "cancelada" ? "Ya está cancelada" : "El viaje ya terminó";
        return (
          <RowActions>
            <RowIcon tone="view" label="Ver reserva" href={href(row)} />
            {can.modify && <RowIcon tone="edit" label="Editar" href={`${href(row)}?editar=1`} disabledHint={closed ? hint : undefined} />}
            {can.cancel && <RowIcon tone="delete" label="Cancelar" icon={<Ban size={15} />} href={`${href(row)}?cancelar=1`} disabledHint={closed ? hint : undefined} />}
          </RowActions>
        );
      },
    },
  ];

  const metrics: MetricFilter<ReservationRow>[] = [
    { id: "traveling", label: "De viaje ahora", tone: "t4", icon: <Plane size={19} />, matches: traveling },
    { id: "confirmed", label: "Confirmadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "confirmada" },
    { id: "balance", label: "Con saldo por cobrar", tone: "warn", icon: <Wallet size={19} />, matches: (row) => (row.balance_pen ?? 0) > 0 },
    { id: "incidents", label: "Con incidencia", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.open_incidents > 0 },
  ];

  const filters: FilterConfig<ReservationRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "channel", label: "Canal", options: unique(rows.map((row) => row.channel)).map((value) => ({ value, label: value })), value: (row) => row.channel },
  ];

  const sorts: SortOption<ReservationRow>[] = [
    { id: "travel", label: "Fecha de viaje", type: "date", value: (row) => row.travel_from },
    { id: "total", label: "Total en soles", type: "number", value: (row) => row.total_pen ?? 0 },
    { id: "balance", label: "Saldo por cobrar", type: "number", value: (row) => row.balance_pen ?? 0 },
  ];

  const amounts = new Set(["total", "balance"]);
  const visibleColumns = prices ? columns : columns.filter((column) => !amounts.has(column.id));
  const visibleMetrics = prices ? metrics : metrics.filter((metric) => !amounts.has(metric.id));
  const visibleSorts = prices ? sorts : sorts.filter((sort) => !amounts.has(sort.id));

  return (
    <DataTable
      screen="reservas"
      rows={rows}
      columns={visibleColumns}
      getKey={(row) => row.code}
      entityLabel="reservas"
      searchText={(row) => `${row.code} ${row.title} ${row.client.name}`}
      searchPlaceholder="Buscar reserva o cliente"
      metrics={visibleMetrics}
      filters={filters}
      sorts={visibleSorts}
    />
  );
}
