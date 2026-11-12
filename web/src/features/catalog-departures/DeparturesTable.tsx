"use client";

import { CalendarCheck, CalendarX, CircleDot, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { DetailPanel, NameButton, OccupancyBar, PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { HOLD_STATUS, type AvailabilityOverview } from "@/lib/catalog-availability";
import { DEPARTURE_STATUS, type DepartureRow, type DeparturesOverview } from "@/lib/catalog-departures";
import type { CsvExport } from "@/lib/csv";
import { formatDate, monthName } from "@/lib/format";
import { DepartureCloseAction, DepartureEditAction } from "./DepartureForms";
import { DepartureHoldAction, DepartureSellAction, type SellableDeparture } from "./DepartureSales";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const weekday = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

type DepartureHold = AvailabilityOverview["holds"][number];

export function DepartureDetail({ departure, trigger, holds = [] }: { departure: DepartureRow; trigger?: (open: () => void) => ReactNode; holds?: DepartureHold[] }) {
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
      {holds.length > 0 && (
        <PanelSection title="Holds y ventas de esta salida">
          <ul className="flex flex-col gap-1.5">
            {holds.map((hold) => (
              <li key={hold.ref} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-surface-2">
                <span className="min-w-0">
                  <b className="block truncate font-semibold">{hold.quantity} cupos · {hold.reference}</b>
                  <small className="font-mono text-[11.5px] text-fg-3">{hold.ref}</small>
                </span>
                <Badge tone={hold.expired ? "bad" : HOLD_STATUS[hold.status].tone}>{hold.expired ? "Vencido" : HOLD_STATUS[hold.status].label}</Badge>
              </li>
            ))}
          </ul>
          <Link href="/catalogo/salidas/holds" className="self-start text-[12.5px] font-semibold text-accent hover:underline">Gestionar en Holds de disponibilidad</Link>
        </PanelSection>
      )}
    </DetailPanel>
  );
}

export function DeparturesTable({ overview, availability }: { overview: DeparturesOverview; availability?: AvailabilityOverview | null }) {
  const sellable = new Map<string, SellableDeparture>((availability?.options.departures ?? []).map((departure) => [departure.ref, { id: departure.id, available: departure.available }]));
  const holdsOf = (departure: DepartureRow) => (availability?.holds ?? []).filter((hold) => hold.departure?.ref === departure.ref);
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
      cell: (departure) => <DepartureDetail departure={departure} holds={holdsOf(departure)} trigger={(open) => <NameButton onClick={open} hint={`${departure.ref} · ${departure.meeting_point}`}>{departure.product.name}</NameButton>} />,
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
          <DepartureDetail departure={departure} holds={holdsOf(departure)} />
          {availability?.can.manage_holds && <DepartureHoldAction departure={departure} sellable={sellable.get(departure.ref)} />}
          {overview.can.manage && <DepartureSellAction departure={departure} sellable={sellable.get(departure.ref)} />}
          {overview.can.manage && <DepartureEditAction overview={overview} departure={departure} />}
          {overview.can.manage && <DepartureCloseAction departure={departure} />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<DepartureRow>[] = [
    { id: "open", label: "Con cupo", tone: "ok", icon: <CircleDot size={19} />, matches: (departure) => departure.available > 0 },
    { id: "full", label: "Completas", tone: "sun", icon: <Users size={19} />, matches: (departure) => departure.status === "completa" },
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

  const csv: CsvExport<DepartureRow> = {
    fileName: "salidas",
    columns: [
      { header: "Salida", value: (departure) => departure.ref },
      { header: "Producto", value: (departure) => departure.product.name },
      { header: "Código del producto", value: (departure) => departure.product.code },
      { header: "Fecha", value: (departure) => departure.date },
      { header: "Hora", value: (departure) => departure.time },
      { header: "Capacidad", value: (departure) => departure.capacity },
      { header: "Vendidos", value: (departure) => departure.sold },
      { header: "En hold", value: (departure) => departure.held },
      { header: "Libres", value: (departure) => departure.available },
      { header: "Ocupación %", value: (departure) => Math.round(((departure.sold + departure.held) / Math.max(departure.capacity, 1)) * 100) },
      { header: "Estado", value: (departure) => DEPARTURE_STATUS[departure.status].label },
      { header: "Guía", value: (departure) => departure.guide?.name ?? "Sin asignar" },
      { header: "Vehículo", value: (departure) => departure.vehicle?.plate ?? "Sin asignar" },
      { header: "Punto de encuentro", value: (departure) => departure.meeting_point },
    ],
  };

  return (
    <DataTable
      csv={csv}
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
