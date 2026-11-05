"use client";

import { CircleCheck, Eye, Plane, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import type { ReservationRow } from "@/lib/reservations";
import { statusLabel } from "@/lib/tone";

const href = (row: ReservationRow) => `/reservas/${row.code}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

export function ReservationsTable({ rows, today }: { rows: ReservationRow[]; today: string }) {
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
    { id: "total", header: "Total", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.total, row.currency)}</span> },
    {
      id: "balance",
      header: "Por cobrar",
      align: "right",
      cell: (row) => (row.balance_pen > 0 ? <span className="font-mono text-[13px] text-bad">{formatMoney(row.balance_pen)}</span> : <span className="text-[12.5px] text-ok">Pagado</span>),
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
      cell: (row) => (
        <Link href={href(row)} aria-label={`Ver ${row.code}`} title="Ver reserva" className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] bg-accent/10 text-accent">
          <Eye size={16} />
        </Link>
      ),
    },
  ];

  const metrics: MetricFilter<ReservationRow>[] = [
    { id: "traveling", label: "De viaje ahora", tone: "t4", icon: <Plane size={19} />, matches: traveling },
    { id: "confirmed", label: "Confirmadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "confirmada" },
    { id: "balance", label: "Con saldo por cobrar", tone: "warn", icon: <Wallet size={19} />, matches: (row) => row.balance_pen > 0 },
    { id: "incidents", label: "Con incidencia", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.open_incidents > 0 },
  ];

  const filters: FilterConfig<ReservationRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "channel", label: "Canal", options: unique(rows.map((row) => row.channel)).map((value) => ({ value, label: value })), value: (row) => row.channel },
  ];

  const sorts: SortOption<ReservationRow>[] = [
    { id: "travel", label: "Fecha de viaje", type: "date", value: (row) => row.travel_from },
    { id: "total", label: "Total en soles", type: "number", value: (row) => row.total_pen },
    { id: "balance", label: "Saldo por cobrar", type: "number", value: (row) => row.balance_pen },
  ];

  return (
    <DataTable
      screen="reservas"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="reservas"
      searchText={(row) => `${row.code} ${row.title} ${row.client.name}`}
      searchPlaceholder="Buscar reserva o cliente"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
