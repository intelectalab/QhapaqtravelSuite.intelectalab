"use client";

import { Building2, Plane, Sprout, Star } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { ClientArchiveAction } from "./ClientForms";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveTag } from "@/components/ui/Badge";
import type { ClientRow } from "@/lib/clients";
import type { CsvExport } from "@/lib/csv";
import { formatDate, formatMoney, shortName } from "@/lib/format";
import type { Tone } from "@/lib/tone";

const SEGMENT_TONE: Record<string, Tone> = { Corporativo: "t1", VIP: "sun", Particular: "mute", "Agencia aliada": "t3", Grupos: "t4" };

const uniqueOptions = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const buildColumns = (canManage: boolean): Column<ClientRow>[] => [
  {
    id: "client",
    header: "Cliente",
    mobile: "title",
    cell: (client) => (
      <div className="flex items-center gap-3">
        <Avatar name={client.name} />
        <div className="min-w-0">
          <Link href={`/crm/clientes/${client.id}`} className="font-semibold hover:underline">
            {client.name}
          </Link>
          {client.onTrip && (
            <span className="ml-2">
              <LiveTag>De viaje</LiveTag>
            </span>
          )}
          <small className="block text-xs text-fg-3">
            {client.id} · {client.document}
          </small>
        </div>
      </div>
    ),
  },
  { id: "segment", header: "Segmento", cell: (client) => <Badge tone={SEGMENT_TONE[client.segment] ?? "mute"}>{client.segment}</Badge> },
  {
    id: "location",
    header: "Ubicación",
    wideOnly: true,
    cell: (client) => (
      <span className="leading-tight">
        <b className="block font-medium">{client.city}</b>
        <span className="text-xs text-fg-3">{client.country}</span>
      </span>
    ),
  },
  { id: "reservations", header: "Reservas", align: "right", wideOnly: true, cell: (client) => <span className="font-mono text-[13px]">{client.reservations}</span> },
  { id: "total", header: "Total comprado", align: "right", cell: (client) => <span className="font-mono text-[13px]">{formatMoney(client.totalPen)}</span> },
  {
    id: "balance",
    header: "Saldo",
    align: "right",
    cell: (client) => (client.balancePen > 0 ? <span className="font-mono text-[13px] font-semibold text-warn">{formatMoney(client.balancePen)}</span> : <span className="text-[13px] text-fg-3">Al día</span>),
  },
  {
    id: "satisfaction",
    header: "Satisfacción",
    wideOnly: true,
    cell: (client) =>
      client.satisfaction === null ? (
        <span className="text-fg-3">Sin encuesta</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{client.satisfaction}</span>
          <span className="h-[5px] w-[46px] overflow-hidden rounded-full bg-surface-2 max-md:hidden">
            <span className="block h-full rounded-full bg-t4" style={{ width: `${client.satisfaction * 10}%` }} />
          </span>
        </span>
      ),
  },
  {
    id: "purchase",
    header: "Última compra",
    cell: (client) => (client.lastPurchase ? <span className="text-[13px] text-fg-2">{formatDate(client.lastPurchase)}</span> : <span className="text-[13px] text-fg-3">Sin compras</span>),
  },
  {
    id: "owner",
    header: "Responsable",
    cell: (client) => (
      <span className="flex items-center gap-2 text-[13px]">
        <Avatar name={client.ownerName} size="xs" solid className="max-md:hidden" />
        {shortName(client.ownerName)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (client) => (
      <RowActions>
        <RowIcon tone="view" label="Ver ficha" href={`/crm/clientes/${client.id}`} />
        {canManage && (
          <>
            <RowIcon tone="edit" label="Editar" href={`/crm/clientes/${client.id}?editar=1`} />
            <ClientArchiveAction client={client} iconOnly />
          </>
        )}
      </RowActions>
    ),
  },
];

const metrics: MetricFilter<ClientRow>[] = [
  { id: "onTrip", label: "De viaje ahora", tone: "t4", icon: <Plane size={19} />, matches: (client) => client.onTrip },
  { id: "vip", label: "VIP y grupos", tone: "sun", icon: <Star size={19} />, matches: (client) => client.segment === "VIP" || client.segment === "Grupos" },
  { id: "companies", label: "Empresas", tone: "t1", icon: <Building2 size={19} />, matches: (client) => client.kind === "Empresa" },
  { id: "noTrips", label: "Aún sin viajar", tone: "t3", icon: <Sprout size={19} />, matches: (client) => client.trips === 0 },
];

const sorts: SortOption<ClientRow>[] = [
  { id: "name", label: "Nombre", type: "text", value: (client) => client.name },
  { id: "total", label: "Total comprado", type: "number", value: (client) => client.totalPen },
  { id: "balance", label: "Saldo", type: "number", value: (client) => client.balancePen },
  { id: "purchase", label: "Última compra", type: "date", value: (client) => client.lastPurchase },
  { id: "trip", label: "Fecha de viaje", type: "date", value: (client) => client.lastTripFrom },
  { id: "since", label: "Cliente desde", type: "date", value: (client) => client.createdAt },
];

const csv: CsvExport<ClientRow> = {
  fileName: "clientes",
  columns: [
    { header: "Código", value: (client) => client.id },
    { header: "Cliente", value: (client) => client.name },
    { header: "Tipo", value: (client) => client.kind },
    { header: "Documento", value: (client) => client.document },
    { header: "Correo", value: (client) => client.email },
    { header: "Teléfono", value: (client) => client.phone },
    { header: "Ciudad", value: (client) => client.city },
    { header: "País", value: (client) => client.country },
    { header: "Segmento", value: (client) => client.segment },
    { header: "Reservas", value: (client) => client.reservations },
    { header: "Total comprado (S/)", value: (client) => client.totalPen },
    { header: "Saldo (S/)", value: (client) => client.balancePen },
    { header: "Satisfacción", value: (client) => client.satisfaction },
    { header: "Última compra", value: (client) => client.lastPurchase },
    { header: "Responsable", value: (client) => client.ownerName },
  ],
};

export function ClientsTable({ clients, canManage }: { clients: ClientRow[]; canManage: boolean }) {
  const filters: FilterConfig<ClientRow>[] = [
    { id: "kind", label: "Tipo", options: [{ value: "Persona", label: "Personas" }, { value: "Empresa", label: "Empresas" }], value: (client) => client.kind },
    { id: "segment", label: "Segmento", options: uniqueOptions(clients.map((client) => client.segment)), value: (client) => client.segment },
    { id: "owner", label: "Responsable", options: uniqueOptions(clients.map((client) => client.ownerName)), value: (client) => client.ownerName },
    { id: "country", label: "País", options: uniqueOptions(clients.map((client) => client.country)), value: (client) => client.country },
  ];

  return (
    <DataTable
      screen="clientes"
      rows={clients}
      columns={buildColumns(canManage)}
      getKey={(client) => client.id}
      entityLabel="clientes"
      searchText={(client) => `${client.name} ${client.document} ${client.email} ${client.phone} ${client.city} ${client.id}`}
      searchPlaceholder="Buscar cliente o documento"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      csv={csv}
    />
  );
}
