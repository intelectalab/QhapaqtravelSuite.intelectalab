"use client";

import { Building2, Eye, MoreHorizontal, Plane, Send, Sprout, Star, Tag, UserPlus } from "lucide-react";
import Link from "next/link";
import { BulkAction, DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveTag } from "@/components/ui/Badge";
import type { ClientRow } from "@/lib/clients";
import { formatDate, formatMoney, shortName } from "@/lib/format";
import type { Tone } from "@/lib/tone";

const SEGMENT_TONE: Record<string, Tone> = { Corporativo: "t1", VIP: "sun", Particular: "mute", "Agencia aliada": "t3", Grupos: "t4" };

const uniqueOptions = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const columns: Column<ClientRow>[] = [
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
  { id: "total", header: "Total comprado", align: "right", cell: (client) => <span className="font-mono text-[13px]">{formatMoney(client.totalPen)}</span> },
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
    id: "trip",
    header: "Viaje",
    cell: (client) => {
      if (client.onTrip) return <span className="font-semibold text-t4">En curso</span>;
      if (!client.lastTripFrom) return <span className="text-fg-3">Aún no viaja</span>;
      if (client.upcomingTrip) return <span>Viaja el {formatDate(client.lastTripFrom)}</span>;
      return <span className="text-fg-2">Viajó el {formatDate(client.lastTripFrom)}</span>;
    },
  },
  {
    id: "owner",
    header: "Asesor",
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
      <span className="flex justify-end gap-1">
        <Link href={`/crm/clientes/${client.id}`} aria-label={`Ver ficha de ${client.name}`} title="Ver ficha" className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent/10 text-accent">
          <Eye size={16} />
        </Link>
        <button type="button" aria-label="Más acciones" className="grid h-8 w-8 place-items-center rounded-[9px] text-fg-3 hover:bg-surface-2">
          <MoreHorizontal size={16} />
        </button>
      </span>
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
  { id: "trip", label: "Fecha de viaje", type: "date", value: (client) => client.lastTripFrom },
  { id: "since", label: "Cliente desde", type: "date", value: (client) => client.createdAt },
];

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const filters: FilterConfig<ClientRow>[] = [
    { id: "kind", label: "Tipo", options: [{ value: "Persona", label: "Personas" }, { value: "Empresa", label: "Empresas" }], value: (client) => client.kind },
    { id: "segment", label: "Segmento", options: uniqueOptions(clients.map((client) => client.segment)), value: (client) => client.segment },
    { id: "owner", label: "Asesor", options: uniqueOptions(clients.map((client) => client.ownerName)), value: (client) => client.ownerName },
    { id: "country", label: "País", options: uniqueOptions(clients.map((client) => client.country)), value: (client) => client.country },
  ];

  return (
    <DataTable
      screen="clientes"
      rows={clients}
      columns={columns}
      getKey={(client) => client.id}
      entityLabel="clientes"
      searchText={(client) => `${client.name} ${client.document} ${client.email} ${client.id}`}
      searchPlaceholder="Buscar cliente o documento"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      selectionActions={() => (
        <>
          <BulkAction icon={<UserPlus size={16} />}>Asignar asesor</BulkAction>
          <BulkAction icon={<Send size={16} />}>Enviar mensaje</BulkAction>
          <BulkAction icon={<Tag size={16} />}>Cambiar segmento</BulkAction>
        </>
      )}
    />
  );
}
