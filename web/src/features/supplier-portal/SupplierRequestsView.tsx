"use client";

import { AlarmClock, CheckCircle2, Hourglass, XCircle } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card } from "@/components/ui/Card";
import { PortalTitle } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { dayDistance, deadlineLabel, scheduleLabel, SERVICE_KINDS, supplierStatus, type SupplierRequest, type SupplierRequests } from "@/lib/supplier-portal";
import { toneStyle } from "@/lib/tone";
import { ConfirmPanel, RejectPanel } from "./RequestActions";
import { KindIcon, PaxLine, requestTone, SupplierBadge } from "./SupplierUi";

export function SupplierRequestsView({ data, contact }: { data: SupplierRequests; contact: string }) {
  const pending = data.rows.filter((row) => row.state === "por_responder");
  const overdue = pending.filter((row) => row.overdue);

  const columns: Column<SupplierRequest>[] = [
    {
      id: "service",
      header: "Servicio",
      mobile: "title",
      cell: (row) => (
        <span style={toneStyle(requestTone(row))} className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] text-[var(--tint)]">
            <KindIcon kind={row.kind} size={16} />
          </span>
          <span className="min-w-0">
            <Link href={`/proveedor/solicitudes/${row.code}`} className="block max-w-[340px] truncate font-semibold transition-colors hover:text-t1 hover:underline">
              {row.service}
            </Link>
            <span className="block text-[12px] text-fg-3">
              {row.reservation} · {SERVICE_KINDS[row.kind] ?? row.kind}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "date",
      header: "Fecha",
      cell: (row) => (
        <span className="block leading-tight">
          <b className="block text-[13px] font-semibold">{formatDate(row.date)}</b>
          <span className={cn("text-[12px]", row.days_to >= 0 && row.days_to <= 2 && row.state === "por_responder" ? "font-semibold text-bad" : "text-fg-3")}>
            {scheduleLabel(row)} · {dayDistance(row.days_to)}
          </span>
        </span>
      ),
    },
    {
      id: "holder",
      header: "Grupo o titular",
      mobile: "detail",
      cell: (row) => (
        <span className="block leading-tight">
          <span className="block text-[13px]">{row.holder}</span>
          <PaxLine pax={row.pax} rooms={row.rooms} nights={row.nights} />
        </span>
      ),
    },
    { id: "cost", header: "Tarifa neta", align: "right", cell: (row) => <b className="text-[13px] font-semibold">{formatMoney(row.net_cost, row.currency)}</b> },
    {
      id: "state",
      header: "Estado",
      cell: (row) => {
        const deadline = row.state === "por_responder" ? deadlineLabel(row) : null;
        return (
          <span className="flex flex-col items-start gap-1">
            <SupplierBadge status={row.state} scope="request" />
            {row.confirmation_code && <span className="font-mono text-[12px] text-fg-2">{row.confirmation_code}</span>}
            {deadline && <span className={cn("text-[11.5px]", row.overdue ? "font-semibold text-bad" : "text-fg-3")}>{deadline}</span>}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver solicitud" href={`/proveedor/solicitudes/${row.code}`} />
          {row.state === "por_responder" && (
            <>
              <ConfirmPanel row={row} contact={contact} asIcon />
              <RejectPanel row={row} reasons={data.reasons} today={data.today} asIcon />
            </>
          )}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<SupplierRequest>[] = [
    { id: "pending", label: "Por responder", icon: <Hourglass size={16} />, tone: "warn", matches: (row) => row.state === "por_responder" },
    { id: "overdue", label: "Fuera de plazo", icon: <AlarmClock size={16} />, tone: "bad", matches: (row) => row.state === "por_responder" && row.overdue },
    { id: "confirmed", label: "Confirmados", icon: <CheckCircle2 size={16} />, tone: "ok", matches: (row) => ["confirmado", "en_curso", "completado"].includes(row.state) },
    { id: "rejected", label: "Rechazados", icon: <XCircle size={16} />, tone: "mute", matches: (row) => row.state === "rechazado" || row.state === "cancelado" },
  ];

  const states = [...new Set(data.rows.map((row) => row.state))];
  const kinds = [...new Set(data.rows.map((row) => row.kind))];
  const filters: FilterConfig<SupplierRequest>[] = [
    { id: "state", label: "Estado", options: states.map((value) => ({ value, label: supplierStatus(value, "request").label })), value: (row) => row.state },
    { id: "kind", label: "Tipo", options: kinds.map((value) => ({ value, label: SERVICE_KINDS[value] ?? value })), value: (row) => row.kind },
  ];
  const sorts: SortOption<SupplierRequest>[] = [
    { id: "date", label: "Fecha del servicio", type: "date", value: (row) => row.date },
    { id: "cost", label: "Tarifa neta", type: "number", value: (row) => row.net_cost },
    { id: "pax", label: "Pasajeros", type: "number", value: (row) => row.pax },
  ];

  return (
    <>
      <PortalTitle title="Solicitudes de servicio" subtitle={`Responda cada solicitud en máximo ${data.response_hours} horas. Solo ve el titular o grupo, los pasajeros y su tarifa neta.`} />
      {overdue.length > 0 && (
        <Card className="mb-5 border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_6%,var(--surface))]">
          <p className="flex items-start gap-2.5 text-[13.5px] text-fg-2">
            <AlarmClock size={18} className="mt-0.5 flex-none text-bad" />
            <span>
              <b className="text-bad">{overdue.length === 1 ? "Una solicitud superó el plazo." : `${overdue.length} solicitudes superaron el plazo.`}</b> Mientras no responda, la agencia no puede emitir el voucher al pasajero.
            </span>
          </p>
        </Card>
      )}
      <DataTable
        screen="proveedor-solicitudes"
        rows={data.rows}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="solicitudes"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        searchText={(row) => `${row.code} ${row.reservation} ${row.service} ${row.holder} ${row.confirmation_code ?? ""}`}
        searchPlaceholder="Buscar servicio, reserva o código"
        emptyTitle={pending.length === 0 && data.rows.length === 0 ? "Aún no recibe solicitudes" : "No hay coincidencias"}
      />
    </>
  );
}
