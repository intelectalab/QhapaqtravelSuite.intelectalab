"use client";

import { CalendarCheck, CalendarX, CircleDot, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { DetailPanel, NameButton, OccupancyBar } from "@/features/catalog-shared/CatalogPanels";
import { DEPARTURE_STATUS, type DepartureRow, type DeparturesOverview } from "@/lib/catalog-departures";
import { formatDate, monthName } from "@/lib/format";
import { DepartureCloseAction, DepartureEditAction } from "./DepartureForms";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const weekday = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

function DepartureDetail({ departure, trigger }: { departure: DepartureRow; trigger?: (open: () => void) => ReactNode }) {
  return (
    <DetailPanel title={departure.product.name} description={`${departure.ref} · ${formatDate(departure.date, "long")} a las ${departure.time}`} trigger={trigger}>
      <div className="rounded-xl bg-surface-2 p-4">
        <OccupancyBar capacity={departure.capacity} sold={departure.sold} held={departure.held} />
      </div>
      <FieldList
        fields={[
          { label: "Producto", value: <Link href={`/catalogo/productos/${departure.product.code}`} className="font-semibold text-accent hover:underline">{departure.product.code}</Link> },
          { label: "Estado", value: <Badge tone={DEPARTURE_STATUS[departure.status].tone}>{DEPARTURE_STATUS[departure.status].label}</Badge> },
          { label: "Encuentro", value: departure.meeting_point },
          { label: "Retorno", value: departure.return_point ?? "—" },
          { label: "Proveedor", value: departure.provider.name ?? "—" },
          { label: "Guía", value: departure.guide?.name ?? "Sin asignar" },
          { label: "Vehículo", value: departure.vehicle ? `${departure.vehicle.plate} · ${departure.vehicle.capacity} asientos` : "Sin asignar" },
        ]}
      />
      {departure.notes && <p className="whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{departure.notes}</p>}
    </DetailPanel>
  );
}

export function DeparturesTable({ overview }: { overview: DeparturesOverview }) {
  const columns: Column<DepartureRow>[] = [
    {
      id: "date",
      header: "Fecha",
      cell: (departure) => (
        <span className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-surface-2 text-center leading-none transition-transform duration-300 group-hover:-rotate-3">
            <b className="text-[15px] font-bold">{departure.date.slice(8, 10)}</b>
            <small className="text-[10px] text-fg-3">{monthName(departure.date).slice(0, 3)}</small>
          </span>
          <span className="text-[12.5px] text-fg-3">
            {weekday(departure.date)}
            <b className="block font-mono text-[13px] font-semibold text-fg">{departure.time}</b>
          </span>
        </span>
      ),
    },
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (departure) => <DepartureDetail departure={departure} trigger={(open) => <NameButton onClick={open} hint={`${departure.ref} · ${departure.meeting_point}`}>{departure.product.name}</NameButton>} />,
    },
    { id: "occupancy", header: "Ocupación", cell: (departure) => <OccupancyBar capacity={departure.capacity} sold={departure.sold} held={departure.held} /> },
    { id: "guide", header: "Guía", wideOnly: true, cell: (departure) => <span className="text-[13px] text-fg-2">{departure.guide?.name ?? "Sin asignar"}</span> },
    { id: "status", header: "Estado", cell: (departure) => <Badge tone={DEPARTURE_STATUS[departure.status].tone}>{DEPARTURE_STATUS[departure.status].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (departure) => (
        <RowActions>
          <DepartureDetail departure={departure} />
          {overview.can.manage && <DepartureEditAction overview={overview} departure={departure} />}
          {overview.can.manage && <DepartureCloseAction departure={departure} />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<DepartureRow>[] = [
    { id: "open", label: "Con cupo", tone: "ok", icon: <CircleDot size={19} />, matches: (departure) => departure.available > 0 },
    { id: "full", label: "Completas", tone: "sun", icon: <Users size={19} />, matches: (departure) => departure.status === "completa" || (departure.status === "abierta" && departure.available === 0) },
    { id: "closed", label: "Cerradas", tone: "mute", icon: <CalendarCheck size={19} />, matches: (departure) => departure.status === "cerrada" },
    { id: "cancelled", label: "Canceladas", tone: "bad", icon: <CalendarX size={19} />, matches: (departure) => departure.status === "cancelada" },
  ];
  const filters: FilterConfig<DepartureRow>[] = [
    { id: "product", label: "Producto", options: unique(overview.departures.map((departure) => departure.product.name)), value: (departure) => departure.product.name },
    { id: "status", label: "Estado", options: Object.entries(DEPARTURE_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (departure) => departure.status },
    { id: "period", label: "Periodo", options: [{ value: "future", label: "Próximas" }, { value: "past", label: "Pasadas" }], value: (departure) => (departure.future ? "future" : "past") },
  ];
  const sorts: SortOption<DepartureRow>[] = [
    { id: "date", label: "Fecha", type: "date", value: (departure) => `${departure.date}T${departure.time}` },
    { id: "available", label: "Libres", type: "number", value: (departure) => departure.available },
    { id: "occupancy", label: "Ocupación", type: "number", value: (departure) => (departure.sold + departure.held) / departure.capacity },
  ];

  return (
    <DataTable
      screen="salidas"
      rows={overview.departures}
      columns={columns}
      getKey={(departure) => departure.ref}
      entityLabel="salidas"
      searchText={(departure) => `${departure.ref} ${departure.product.name} ${departure.product.code} ${departure.guide?.name ?? ""} ${departure.meeting_point}`}
      searchPlaceholder="Buscar producto, código o guía"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
