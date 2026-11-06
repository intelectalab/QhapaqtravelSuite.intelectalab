"use client";

import { CircleCheck, CircleSlash, Hourglass, UserX } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { CountTip } from "@/components/ui/InfoTip";
import { DetailPanel, NameButton, PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { SUPPLY_STATE, type ServiceRow, type ServicesOverview } from "@/lib/catalog-services";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { ServiceEditAction, ServiceToggleAction } from "./ServiceForms";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

function ServiceDetail({ service, overview, open }: { service: ServiceRow; overview: ServicesOverview; open?: boolean }) {
  return (
    <DetailPanel
      title={service.name}
      description={`${service.ref} · ${service.type}`}
      trigger={open ? (show) => <NameButton onClick={show} hint={`${service.ref} · ${service.type}`}>{service.name}</NameButton> : undefined}
    >
      <FieldList
        fields={[
          { label: "Proveedor", value: <span>{service.provider.name} <Badge tone={SUPPLY_STATE[service.provider.state].tone}>{SUPPLY_STATE[service.provider.state].label}</Badge></span> },
          ...(overview.can.see_cost && service.cost !== null ? [{ label: "Costo", value: <b className="font-mono">{formatMoney(Number(service.cost), service.currency)} por {service.unit}</b> }] : [{ label: "Se cobra por", value: service.unit }]),
          { label: "Capacidad", value: service.capacity ?? "Sin límite" },
          { label: "Vigencia", value: `${formatDate(service.valid_from)} – ${formatDate(service.valid_to)}` },
          { label: "Estado", value: <Badge tone={SUPPLY_STATE[service.state].tone}>{SUPPLY_STATE[service.state].label}</Badge> },
        ]}
      />
      <PanelSection title={`Productos que lo usan (${service.products.length})`}>
        {service.products.length ? (
          <ul className="flex flex-col gap-1.5">
            {service.products.map((product) => (
              <li key={product.code}>
                <Link href={`/catalogo/productos/${product.code}`} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-surface-2">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-mono text-[11.5px] text-fg-3">{product.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-fg-3">Aún no forma parte de ningún producto.</p>
        )}
      </PanelSection>
    </DetailPanel>
  );
}

export function ServicesTable({ overview }: { overview: ServicesOverview }) {
  const { can } = overview;
  const columns: Column<ServiceRow>[] = [
    { id: "service", header: "Servicio", mobile: "title", cell: (service) => <ServiceDetail service={service} overview={overview} open /> },
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
          <ServiceDetail service={service} overview={overview} />
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
  return <DataTable screen="servicios" rows={overview.services} columns={columns} getKey={(service) => service.ref} entityLabel="servicios" searchText={(service) => `${service.ref} ${service.name} ${service.type} ${service.provider.name}`} searchPlaceholder="Buscar servicio o proveedor" metrics={metrics} filters={filters} sorts={sorts} />;
}
