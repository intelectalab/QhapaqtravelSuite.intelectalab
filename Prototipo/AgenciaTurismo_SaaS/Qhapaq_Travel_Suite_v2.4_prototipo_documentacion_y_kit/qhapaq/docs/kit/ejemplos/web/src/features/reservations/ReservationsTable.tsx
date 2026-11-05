"use client";

/**
 * Ejemplo de pantalla de listado (/reservas) que une las piezas: useReservations (cursor) + DataTable responsive +
 * StatusBadge + permisos en acciones de fila. Ruta Next = ruta del prototipo sin `#/` (`#/reservas` → `/reservas`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SheetAction } from "@/components/ui/ActionSheet";
import { useAccess } from "@/lib/access/access-context";
import { useReservations, type Reservation, type ReservationFilters } from "./api";

const money = (amount?: string, currency?: string) =>
  amount && currency ? new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(Number(amount)) : "—";
const shortDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso)) : "";

export function ReservationsTable({ filters, onCancel }: { filters: ReservationFilters; onCancel: (r: Reservation) => void }) {
  const router = useRouter();
  const { can } = useAccess();
  const query = useReservations(filters);
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);

  const columns = useMemo<ColumnDef<Reservation, unknown>[]>(
    () => [
      { header: "Reserva", accessorKey: "code", cell: (c) => <b>{c.row.original.code}</b> },
      { header: "Título", accessorKey: "title" },
      { header: "Viaje", accessorKey: "travel_from", cell: (c) => `${shortDate(c.row.original.travel_from)} – ${shortDate(c.row.original.travel_to)}` },
      { header: "Canal", accessorKey: "channel" },
      { header: "Estado", accessorKey: "status", cell: (c) => <StatusBadge status={c.row.original.status ?? ""} size="sm" testId="row-status" /> },
      {
        header: "Total",
        accessorKey: "total_amount",
        meta: { align: "right" },
        cell: (c) => (
          <span data-amount={c.row.original.total_amount} className="tabular-nums">
            {money(c.row.original.total_amount, c.row.original.currency)}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = (r: Reservation): SheetAction[] => {
    const closed = r.status === "completada" || r.status === "cancelada"; // spec 04 §4.1: terminales sin acciones
    return [
      { label: "Abrir", testId: `action:open`, onSelect: () => router.push(`/reservas/${r.code}`) },
      ...(!closed
        ? [
            {
              label: "Cancelar",
              testId: "reservation-cancel",
              danger: true,
              disabled: !can("reservations.cancel"),
              hint: "Requiere permiso reservations.cancel",
              onSelect: () => onCancel(r),
            },
          ]
        : []),
    ];
  };

  if (query.isError) {
    return <div role="alert" className="rounded-card bg-bad-soft p-4 text-bad">No se pudo cargar el listado. Intente nuevamente.</div>;
  }

  return (
    <DataTable
      data={rows}
      columns={columns}
      rowCode={(r) => r.code ?? ""}
      rowActions={rowActions}
      onRowClick={(r) => router.push(`/reservas/${r.code}`)}
      caption="Reservas"
      emptyText={query.isLoading ? "Cargando…" : undefined}
      footer={
        query.hasNextPage ? (
          <div className="p-3 text-center">
            <button type="button" className="h-btn rounded-control border border-line px-4" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {query.isFetchingNextPage ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        ) : null
      }
    />
  );
}
