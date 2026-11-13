"use client";

import { Ban, CalendarClock, ClipboardList, Pencil, Plus, Siren, TriangleAlert, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { formatDate } from "@/lib/format";
import type { OrderCandidate, OrderList, OrderRow, Person } from "@/lib/operations";
import { statusLabel } from "@/lib/tone";
import { DateRange, Meter, PersonChip } from "./OpsBits";
import { ConfirmNote, OpsStep } from "./OpsStep";

const href = (code: string) => `/operaciones/ordenes/${code}`;

const CLOSED = ["completada", "cancelada"];

function OrderPreview({ candidate }: { candidate: OrderCandidate | undefined }) {
  if (!candidate || candidate.replicable === undefined) return <ConfirmNote>Elige la reserva para ver qué se copiará a la orden.</ConfirmNote>;
  const replicable = candidate.replicable;
  const others = (candidate.services ?? replicable) - replicable;
  return (
    <ConfirmNote tone={replicable === 0 ? "warn" : "neutral"}>
      {replicable === 0 ? (
        <>La reserva no tiene tours ni traslados: la orden se creará sin servicios por asignar, solo con sus tareas.</>
      ) : (
        <>
          Se replicarán <b className="font-semibold">{replicable === 1 ? "1 servicio" : `${replicable} servicios`}</b> (tours y traslados) para asignarles guía, conductor y vehículo
          {candidate.passengers !== undefined ? `, con ${candidate.passengers === 1 ? "1 pasajero" : `${candidate.passengers} pasajeros`}` : ""}.
          {others > 0 ? ` ${others === 1 ? "El otro servicio de la reserva no pasa" : `Los otros ${others} servicios de la reserva no pasan`} a asignación.` : ""}
        </>
      )}
    </ConfirmNote>
  );
}

export function OrderCreateAction({ candidates, coordinators, viewerId }: { candidates: OrderCandidate[]; coordinators: Person[]; viewerId: string }) {
  const fallback = coordinators.some((person) => person.id === viewerId) ? viewerId : (coordinators[0]?.id ?? "");
  const [reservation, setReservation] = useState("");
  return (
    <OpsStep step="order_create" label="Nueva orden" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title="Nueva orden operativa" description="Se crea desde una reserva confirmada. Los tours y traslados pasan a asignación con las cinco tareas habituales." submitLabel="Crear orden">
      {candidates.length === 0 ? (
        <ConfirmNote>Todas las reservas confirmadas ya tienen su orden operativa.</ConfirmNote>
      ) : (
        <>
          <SelectField label="Reserva" name="reservation_code" value={reservation} onChange={setReservation} options={candidates.map((item) => ({ value: item.code, label: `${item.code} · ${item.title}`, hint: `${item.client} · ${formatDate(item.travel_from)}` }))} placeholder="Elegir reserva" />
          <OrderPreview candidate={candidates.find((item) => item.code === reservation)} />
          <SelectField label="Coordinador" name="coordinator_id" options={coordinators.map((person) => ({ value: person.id, label: person.name }))} defaultValue={fallback} />
        </>
      )}
    </OpsStep>
  );
}

export function OrderEditAction({ code, title, coordinator, coordinators, iconOnly = false }: { code: string; title: string; coordinator: string; coordinators: Person[]; iconOnly?: boolean }) {
  return (
    <OpsStep
      step="order_update"
      target={code}
      label="Coordinador"
      icon={<UserCog size={16} />}
      title="Cambiar coordinador"
      description={`${title} · ${code}`}
      submitLabel="Guardar"
      trigger={iconOnly ? (open) => <RowIcon tone="edit" label="Cambiar coordinador" icon={<Pencil size={15} />} onClick={open} /> : undefined}
    >
      <SelectField label="Coordinador" name="coordinator_id" options={coordinators.map((person) => ({ value: person.id, label: person.name }))} defaultValue={coordinator} />
      <ConfirmNote>El nuevo coordinador recibe las alertas de la orden y queda como responsable por defecto de sus incidencias.</ConfirmNote>
    </OpsStep>
  );
}

export function OrdersTable({ data }: { data: OrderList }) {
  const { items, today, can, coordinators } = data;
  const running = (row: OrderRow) => row.date_from <= today && row.date_to >= today && !CLOSED.includes(row.status);

  const columns: Column<OrderRow>[] = [
    {
      id: "order",
      header: "Orden",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={href(row.code)} className="font-semibold hover:underline">
            {row.title}
          </Link>
          {running(row) && (
            <span className="ml-2">
              <LiveTag>Viaje en curso</LiveTag>
            </span>
          )}
          <small className="block text-xs text-fg-3">
            {row.code} · <Link href={`/reservas/${row.reservation.code}`} className="hover:text-accent hover:underline">{row.reservation.code}</Link> · {row.reservation.client}
          </small>
        </div>
      ),
    },
    {
      id: "operation",
      header: "Operación",
      wideOnly: true,
      cell: (row) => (
        <span className="text-[13px]">
          {row.services === undefined ? "—" : row.services === 1 ? "1 servicio" : `${row.services} servicios`}
          {row.reservation.channel && <span className="block text-xs text-fg-3">Canal {row.reservation.channel}</span>}
        </span>
      ),
    },
    {
      id: "dates",
      header: "Fechas",
      cell: (row) => (
        <span>
          <DateRange from={row.date_from} to={row.date_to} />
          <span className="block text-xs text-fg-3">{row.passengers === 1 ? "1 pasajero" : `${row.passengers} pasajeros`}</span>
        </span>
      ),
    },
    { id: "assignments", header: "Asignaciones", cell: (row) => (row.assignments.total === 0 ? <span className="text-[12.5px] text-fg-3">Sin servicios con recursos</span> : <Meter value={row.assignments.total - row.assignments.pending} total={row.assignments.total} tone={row.assignments.pending > 0 ? "warn" : "ok"} label={`${row.assignments.pending} sin recursos · ${row.assignments.confirmed} confirmadas por el recurso`} />) },
    { id: "tasks", header: "Tareas", wideOnly: true, cell: (row) => <Meter value={row.tasks.done} total={row.tasks.total} tone="violet" /> },
    { id: "coordinator", header: "Coordinador", wideOnly: true, cell: (row) => <PersonChip name={row.coordinator.name} color={row.coordinator.color} /> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {row.open_incidents > 0 && <TriangleAlert size={15} className={row.critical ? "text-bad" : "text-warn"} aria-label={`${row.open_incidents} incidencias abiertas`} />}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => {
        const closed = CLOSED.includes(row.status);
        const hint = row.status === "cancelada" ? "La orden está cancelada" : "La orden ya está cerrada";
        return (
          <RowActions>
            <RowIcon tone="view" label="Ver orden" href={href(row.code)} />
            {can.assign && (closed ? <RowIcon tone="edit" label="Editar" disabledHint={hint} /> : <OrderEditAction code={row.code} title={row.title} coordinator={row.coordinator.id} coordinators={coordinators} iconOnly />)}
            {can.assign && <RowIcon tone="delete" label="Cancelar" icon={<Ban size={15} />} disabledHint={closed ? hint : row.status === "en_ejecucion" ? "En ejecución: registra una incidencia" : "Se cancela al anular su reserva"} />}
          </RowActions>
        );
      },
    },
  ];

  const metrics: MetricFilter<OrderRow>[] = [
    { id: "running", label: "En ejecución", tone: "t4", icon: <CalendarClock size={19} />, matches: (row) => row.status === "en_ejecucion" },
    { id: "pending", label: "Con servicios sin recursos", tone: "warn", icon: <Users size={19} />, matches: (row) => row.assignments.pending > 0 && !CLOSED.includes(row.status) },
    { id: "incidents", label: "Con incidencias abiertas", tone: "bad", icon: <Siren size={19} />, matches: (row) => row.open_incidents > 0 },
    { id: "closed", label: "Completadas", tone: "ok", icon: <ClipboardList size={19} />, matches: (row) => row.status === "completada" },
  ];

  const filters: FilterConfig<OrderRow>[] = [
    { id: "status", label: "Estado", options: [...new Set(items.map((row) => row.status))].map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "coordinator", label: "Coordinador", options: [...new Map(items.map((row) => [row.coordinator.id, row.coordinator.name])).entries()].map(([value, label]) => ({ value, label })), value: (row) => row.coordinator.id },
  ];

  const sorts: SortOption<OrderRow>[] = [
    { id: "from", label: "Inicio", type: "date", value: (row) => row.date_from },
    { id: "pending", label: "Servicios sin recursos", type: "number", value: (row) => row.assignments.pending },
    { id: "created", label: "Creación", type: "date", value: (row) => row.created_at },
  ];

  return (
    <DataTable
      screen="operaciones-ordenes"
      rows={items}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="órdenes"
      searchText={(row) => `${row.code} ${row.title} ${row.reservation.code} ${row.reservation.client} ${row.coordinator.name}`}
      searchPlaceholder="Buscar orden, reserva o cliente"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
