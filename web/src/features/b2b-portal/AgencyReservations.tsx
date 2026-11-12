"use client";

import { Ban, CircleCheck, Hourglass, Plane, UserRoundPen, Wallet } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { PortalTitle } from "@/features/portal/PortalUi";
import { agencyStatus, PAY_MODES, type AgencyReservationRow } from "@/lib/b2b-portal";
import { formatDate, formatMoney } from "@/lib/format";
import { AgencyBadge } from "./AgencyUi";

const href = (row: AgencyReservationRow) => `/agencia/reservas/${row.code}`;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function AgencyReservations({ rows, today }: { rows: AgencyReservationRow[]; today: string }) {
  const live = (row: AgencyReservationRow) => !["cancelada", "completada"].includes(row.status);
  const columns: Column<AgencyReservationRow>[] = [
    {
      id: "title",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={href(row)} className="font-semibold transition hover:text-t3">
            {row.title}
          </Link>
          <small className="block text-xs text-fg-3">
            {row.code}
            {row.reference ? ` · Ref. ${row.reference}` : ""}
            {row.client ? ` · ${row.client}` : ""}
          </small>
        </div>
      ),
    },
    {
      id: "trip",
      header: "Salida",
      cell: (row) => (
        <span className="text-[13px]">
          {formatDate(row.from)}
          <span className="flex items-center gap-1 text-xs text-fg-3">
            {row.pax} {row.pax === 1 ? "pasajero" : "pasajeros"}
            {row.pending_names > 0 && (
              <span className="flex items-center gap-0.5 font-semibold text-info">
                · <UserRoundPen size={11} /> {row.pending_names}
              </span>
            )}
          </span>
        </span>
      ),
    },
    { id: "total", header: "Total neto", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.total, row.currency)}</span> },
    {
      id: "balance",
      header: "Saldo",
      align: "right",
      cell: (row) => (row.balance > 0.004 ? <span className="font-mono text-[13px] text-warn">{formatMoney(row.balance, row.currency)}</span> : <span className="text-[12.5px] text-ok">Pagado</span>),
    },
    { id: "mode", header: "Pago", wideOnly: true, cell: (row) => (row.pay_mode ? <Badge tone={row.pay_mode === "credito" ? "t1" : "warn"}>{PAY_MODES[row.pay_mode].label}</Badge> : <span className="text-fg-3">—</span>) },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <AgencyBadge status={row.status} scope="trip" />
          {row.cancel_pending && <Badge tone="bad">Anulación pedida</Badge>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver reserva" href={href(row)} />
          <RowIcon tone="edit" label="Nominar pasajeros" href={`${href(row)}#pasajeros`} disabledHint={live(row) ? undefined : "La reserva ya no admite cambios"} />
          <RowIcon tone="delete" label="Solicitar anulación" icon={<Ban size={15} />} href={`${href(row)}?cancelar=1`} disabledHint={!live(row) ? "La reserva ya no admite cambios" : row.cancel_pending ? "Ya pediste la anulación" : undefined} />
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<AgencyReservationRow>[] = [
    { id: "upcoming", label: "Próximas salidas", tone: "t3", icon: <Plane size={19} />, matches: (row) => live(row) && row.to >= today },
    { id: "confirmed", label: "Confirmadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "confirmada" },
    { id: "pending", label: "Por confirmar o pagar", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => ["pendiente_pago", "pendiente_proveedor", "pendiente_disponibilidad"].includes(row.status) },
    { id: "balance", label: "Con saldo", tone: "t2", icon: <Wallet size={19} />, matches: (row) => row.balance > 0.004 && row.status !== "cancelada" },
    { id: "names", label: "Por nominar", tone: "info", icon: <UserRoundPen size={19} />, matches: (row) => row.pending_names > 0 && live(row) },
  ];

  const filters: FilterConfig<AgencyReservationRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: agencyStatus(value).label })), value: (row) => row.status },
    { id: "mode", label: "Forma de pago", options: unique(rows.map((row) => row.pay_mode ?? "")).filter(Boolean).map((value) => ({ value, label: PAY_MODES[value as "credito"].label })), value: (row) => row.pay_mode ?? "" },
  ];

  const sorts: SortOption<AgencyReservationRow>[] = [
    { id: "travel", label: "Fecha de salida", type: "date", value: (row) => row.from },
    { id: "created", label: "Fecha de reserva", type: "date", value: (row) => row.created_at },
    { id: "total", label: "Total neto", type: "number", value: (row) => row.total },
    { id: "balance", label: "Saldo", type: "number", value: (row) => row.balance },
  ];

  return (
    <>
      <PortalTitle title="Mis reservas" subtitle="Itinerario, pasajeros, pagos y vouchers de cada reserva de tu agencia." />
      <DataTable
        screen="agencia-reservas"
        rows={rows}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="reservas"
        searchText={(row) => `${row.code} ${row.title} ${row.client ?? ""} ${row.reference ?? ""}`}
        searchPlaceholder="Buscar por reserva, cliente o referencia"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        emptyTitle="Aún no tienes reservas"
      />
    </>
  );
}
