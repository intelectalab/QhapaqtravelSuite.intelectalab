"use client";

import { ArrowUpRight, CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, MetricFilter } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { ContractCell, providerHref, Rating } from "@/features/catalog-providers/ProvidersTable";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/catalog";
import { SUPPLY_STATE, type ServiceDetail } from "@/lib/catalog-services";
import { formatDate, formatMoney } from "@/lib/format";

type UsageRow = ServiceDetail["usage"][number];

const productLabel = (status: string) => PRODUCT_STATUS[status as ProductStatus]?.label ?? status;

export function ServiceSheet({ detail }: { detail: ServiceDetail }) {
  const { service, provider, fx, can } = detail;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <PanelSection title="Datos del servicio">
        <FieldList
          fields={[
            { label: "Código", value: <span className="font-mono">{service.ref}</span> },
            { label: "Tipo", value: service.type },
            { label: "Se cobra por", value: service.unit },
            ...(can.see_cost && service.cost !== null
              ? [
                  { label: "Costo", value: <b className="font-mono">{formatMoney(Number(service.cost), service.currency)}</b> },
                  ...(fx ? [{ label: "Equivale a", value: <span className="font-mono">{formatMoney(fx.cost_pen, "PEN")} <small className="text-fg-3">· TC {fx.rate.toFixed(3)} del {formatDate(fx.date)}</small></span> }] : []),
                ]
              : []),
            ...(service.scheduled_cost && service.scheduled_cost_from ? [{ label: "Costo programado", value: <span className="font-mono">{formatMoney(Number(service.scheduled_cost), service.currency)} desde {formatDate(service.scheduled_cost_from)}</span> }] : []),
            { label: "Capacidad", value: service.capacity ?? "Sin límite" },
            { label: "Vigencia", value: `${formatDate(service.valid_from)} – ${formatDate(service.valid_to)}` },
            { label: "Estado", value: <Badge tone={SUPPLY_STATE[service.state].tone}>{SUPPLY_STATE[service.state].label}</Badge> },
          ]}
        />
      </PanelSection>
      <div className="flex flex-col gap-6">
        {provider && (
          <PanelSection title="Proveedor">
            <Link href={providerHref(provider.ref)} className="lift group flex items-center justify-between gap-3 rounded-xl border border-line-2 px-4 py-3 transition hover:border-line hover:bg-surface-2">
              <span className="min-w-0">
                <b className="block truncate font-semibold transition-colors group-hover:text-accent">{provider.name}</b>
                <small className="text-xs text-fg-3">{provider.ref} · {provider.type}</small>
              </span>
              <ArrowUpRight size={16} className="flex-none text-fg-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
            <FieldList
              fields={[
                { label: "Estado", value: <Badge tone={SUPPLY_STATE[provider.state].tone}>{SUPPLY_STATE[provider.state].label}</Badge> },
                { label: "Contrato", value: <ContractCell provider={provider} /> },
                { label: "Pago", value: provider.payment_terms ?? "—" },
                { label: "Calificación", value: <Rating value={provider.rating} /> },
              ]}
            />
          </PanelSection>
        )}
        {detail.cost_history.length > 0 && (
          <PanelSection title="Costos por periodo">
            <ul className="flex flex-col gap-1.5">
              {detail.cost_history.map((row) => (
                <li key={row.effective_from} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] transition hover:bg-surface-2">
                  <span className="text-fg-2">
                    {formatDate(row.effective_from)}
                    {row.effective_to ? ` – ${formatDate(row.effective_to)}` : " en adelante"}
                  </span>
                  <b className="font-mono">{formatMoney(Number(row.cost), row.currency.trim())}</b>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </div>
    </div>
  );
}

export function ServiceUsageTable({ detail }: { detail: ServiceDetail }) {
  const columns: Column<UsageRow>[] = [
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (row) => (
        <Link href={`/catalogo/productos/${row.code}`} className="block min-w-0">
          <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{row.name}</span>
          <small className="font-mono text-[11.5px] text-fg-3">{row.code}</small>
        </Link>
      ),
    },
    { id: "quantity", header: "Cantidad", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{row.quantity.toLocaleString("es-PE")} <small className="font-sans font-normal text-fg-3">{row.unit ?? detail.service.unit}</small></span> },
    { id: "required", header: "Requerido", cell: (row) => (row.required ? <span className="inline-flex items-center gap-1 text-[13px] text-ok"><CircleCheck size={14} />Sí</span> : <span className="inline-flex items-center gap-1 text-[13px] text-fg-3"><CircleDashed size={14} />Opcional</span>) },
    { id: "included", header: "En el precio", cell: (row) => <span className="text-[13px] text-fg-2">{row.included ? "Incluido" : "Se cobra aparte"}</span> },
    { id: "status", header: "Estado del producto", cell: (row) => <StatusBadge status={row.status} label={productLabel(row.status)} /> },
  ];
  const metrics: MetricFilter<UsageRow>[] = [
    { id: "required", label: "Requerido", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.required },
    { id: "optional", label: "Opcional", tone: "mute", icon: <CircleDashed size={19} />, matches: (row) => !row.required },
  ];
  return (
    <DataTable
      screen="servicio-productos"
      rows={detail.usage}
      columns={columns}
      getKey={(row) => `${row.code}-${row.quantity}-${row.required}`}
      entityLabel="productos"
      searchText={(row) => `${row.code} ${row.name}`}
      searchPlaceholder="Buscar producto"
      metrics={metrics}
      emptyTitle="Aún no forma parte de ningún producto"
      csv={{
        fileName: `productos-${detail.service.ref}`,
        columns: [
          { header: "Código", value: (row) => row.code },
          { header: "Producto", value: (row) => row.name },
          { header: "Cantidad", value: (row) => row.quantity },
          { header: "Unidad", value: (row) => row.unit ?? detail.service.unit },
          { header: "Requerido", value: (row) => row.required },
          { header: "Incluido en el precio", value: (row) => row.included },
          { header: "Estado", value: (row) => productLabel(row.status) },
        ],
      }}
    />
  );
}
