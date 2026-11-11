"use client";

import { CircleCheck, CircleSlash, Hourglass, UserX } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { CountTip } from "@/components/ui/InfoTip";
import { SUPPLY_STATE, type ServiceRow, type ServicesOverview } from "@/lib/catalog-services";
import { cn } from "@/lib/cn";
import type { CsvExport } from "@/lib/csv";
import { formatDate, formatMoney } from "@/lib/format";
import { ServiceEditAction, ServiceToggleAction } from "./ServiceForms";

export const serviceHref = (ref: string) => `/catalogo/servicios/${encodeURIComponent(ref)}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function ServicesTable({ overview }: { overview: ServicesOverview }) {
  const { can } = overview;
  const columns: Column<ServiceRow>[] = [
    {
      id: "service",
      header: "Servicio",
      mobile: "title",
      cell: (service) => (
        <Link href={serviceHref(service.ref)} className="block min-w-0">
          <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{service.name}</span>
          <small className="block truncate text-xs text-fg-3">{service.ref} · {service.type}</small>
        </Link>
      ),
    },
    { id: "provider", header: "Proveedor", cell: (service) => <span className={cn("text-[13px]", service.provider.state !== "activo" && "text-bad")}>{service.provider.name}{service.provider.state !== "activo" && <small className="block text-xs">Proveedor {SUPPLY_STATE[service.provider.state].label.toLowerCase()}</small>}</span> },
    ...(can.see_cost ? [{ id: "cost", header: "Costo", align: "right" as const, cell: (service: ServiceRow) => <span className="block text-right"><b className="font-mono text-[13.5px] font-semibold">{service.cost === null ? "—" : formatMoney(Number(service.cost), service.currency)}</b><small className="block text-[11.5px] text-fg-3">por {service.unit}</small></span> }] : []),
    { id: "validity", header: "Vigencia", wideOnly: true, cell: (service) => <span className="text-[13px]">hasta {formatDate(service.valid_to)}<small className={cn("block text-xs", service.expires_in < 0 ? "text-bad" : service.expires_in <= 90 ? "text-warn" : "text-fg-3")}>{service.expires_in < 0 ? "Vencido" : `${service.expires_in} días`}</small></span> },
    { id: "products", header: "En productos", wideOnly: true, cell: (service) => (service.products.length ? <CountTip items={service.products.map((product) => ({ label: product.name, included: true }))} unit="productos" className="text-[12.5px]" /> : <span className="text-[12.5px] text-fg-3">Ninguno</span>) },
    { id: "state", header: "Estado", cell: (service) => <Badge tone={SUPPLY_STATE[service.state].tone}>{SUPPLY_STATE[service.state].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (service) => (
        <RowActions>
          <RowIcon tone="view" label="Ver ficha" href={serviceHref(service.ref)} />
          {can.manage && <ServiceEditAction overview={overview} service={service} />}
          {can.manage && <ServiceToggleAction service={service} />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ServiceRow>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, matches: (service) => service.state === "activo" },
    { id: "off", label: "Vencidos o inactivos", tone: "mute", icon: <CircleSlash size={19} />, matches: (service) => service.state !== "activo" },
    { id: "expiring", label: "Vencen en 90 días", tone: "sun", icon: <Hourglass size={19} />, matches: (service) => service.state === "activo" && service.expires_in <= 90 },
    { id: "provider", label: "Proveedor no activo", tone: "bad", icon: <UserX size={19} />, matches: (service) => service.provider.state !== "activo" },
  ];
  const filters: FilterConfig<ServiceRow>[] = [
    { id: "type", label: "Tipo", options: unique(overview.services.map((service) => service.type)), value: (service) => service.type },
    { id: "provider", label: "Proveedor", options: unique(overview.services.map((service) => service.provider.name)), value: (service) => service.provider.name },
    { id: "state", label: "Estado", options: Object.entries(SUPPLY_STATE).map(([value, item]) => ({ value, label: item.label })), value: (service) => service.state },
  ];
  const sorts: SortOption<ServiceRow>[] = [
    { id: "name", label: "Nombre", type: "text", value: (service) => service.name },
    { id: "valid_to", label: "Vence", type: "date", value: (service) => service.valid_to },
    ...(can.see_cost ? [{ id: "cost", label: "Costo", type: "number" as const, value: (service: ServiceRow) => (service.cost === null ? null : Number(service.cost)) }] : []),
  ];
  const csv: CsvExport<ServiceRow> = {
    fileName: "servicios",
    columns: [
      { header: "Código", value: (service) => service.ref },
      { header: "Servicio", value: (service) => service.name },
      { header: "Tipo", value: (service) => service.type },
      { header: "Proveedor", value: (service) => service.provider.name },
      { header: "Estado del proveedor", value: (service) => SUPPLY_STATE[service.provider.state].label },
      { header: "Unidad", value: (service) => service.unit },
      ...(can.see_cost ? [{ header: "Costo", value: (service: ServiceRow) => service.cost }, { header: "Moneda", value: (service: ServiceRow) => service.currency }] : []),
      { header: "Capacidad", value: (service) => service.capacity },
      { header: "Vigente desde", value: (service) => service.valid_from },
      { header: "Vigente hasta", value: (service) => service.valid_to },
      { header: "Productos que lo usan", value: (service) => service.products.length },
      { header: "Estado", value: (service) => SUPPLY_STATE[service.state].label },
    ],
  };
  return <DataTable screen="servicios" rows={overview.services} columns={columns} getKey={(service) => service.ref} entityLabel="servicios" searchText={(service) => `${service.ref} ${service.name} ${service.type} ${service.provider.name}`} searchPlaceholder="Buscar servicio o proveedor" metrics={metrics} filters={filters} sorts={sorts} csv={csv} />;
}
