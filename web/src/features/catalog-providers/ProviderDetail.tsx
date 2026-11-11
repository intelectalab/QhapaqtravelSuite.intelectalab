"use client";

import { CircleAlert, CircleCheck, CircleSlash, Crown, Hourglass, Puzzle } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, MetricFilter } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { serviceHref } from "@/features/catalog-services/ServicesTable";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/catalog";
import type { ProviderDetail } from "@/lib/catalog-providers";
import { SUPPLY_STATE } from "@/lib/catalog-services";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { ContractCell, Rating } from "./ProvidersTable";
import { ProviderContacts } from "./ProviderForms";

type ServiceItem = ProviderDetail["services"][number];
type ProductItem = ProviderDetail["products"][number];
type ReservationItem = NonNullable<ProviderDetail["reservations"]>[number];
type PayableItem = NonNullable<ProviderDetail["payables"]>[number];

const productLabel = (status: string) => PRODUCT_STATUS[status as ProductStatus]?.label ?? status;

export function ProviderSummary({ detail }: { detail: ProviderDetail }) {
  const { provider, can } = detail;
  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <PanelSection title="Datos y contrato">
            <FieldList
              fields={[
                { label: "Razón social", value: provider.name },
                { label: "RUC", value: <span className="font-mono">{provider.ruc}</span> },
                { label: "Tipo", value: provider.stars ? `${provider.type} · ${provider.stars} estrellas` : provider.type },
                { label: "Ciudad", value: provider.city ?? "—" },
                { label: "Contrato", value: <span>{formatDate(provider.contract_start)} – <ContractCell provider={provider} /></span> },
                { label: "Moneda", value: provider.currency },
                { label: "Pago", value: provider.payment_terms ?? "—" },
                { label: "Estado", value: <Badge tone={SUPPLY_STATE[provider.state].tone}>{SUPPLY_STATE[provider.state].label}</Badge> },
              ]}
            />
          </PanelSection>
          <PanelSection title="Calificación">
            <div className="flex items-start gap-4 rounded-xl bg-surface-2 px-4 py-3.5">
              <span className="text-[26px] font-bold leading-none tracking-tight">{provider.rating ? provider.rating.toFixed(1) : "—"}</span>
              <span className="min-w-0 text-[13px]">
                <Rating value={provider.rating} />
                <span className="mt-1 block text-fg-2">{provider.rating_note ?? "Sin comentario."}</span>
              </span>
            </div>
          </PanelSection>
        </div>
        <ProviderContacts provider={provider} manage={can.manage} />
      </div>
    </Card>
  );
}

export function ProviderServicesTable({ detail }: { detail: ProviderDetail }) {
  const seesCost = detail.services.some((service) => service.cost !== null);
  const columns: Column<ServiceItem>[] = [
    {
      id: "service",
      header: "Servicio",
      mobile: "title",
      cell: (service) => (
        <Link href={serviceHref(service.ref)} className="block min-w-0">
          <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{service.name}</span>
          <small className="text-xs text-fg-3">{service.ref} · {service.type}</small>
        </Link>
      ),
    },
    ...(seesCost ? [{ id: "cost", header: "Costo", align: "right" as const, cell: (service: ServiceItem) => <span className="block text-right"><b className="font-mono text-[13.5px]">{service.cost === null ? "—" : formatMoney(Number(service.cost), service.currency)}</b><small className="block text-[11.5px] text-fg-3">por {service.unit}</small></span> }] : []),
    { id: "valid", header: "Vigente hasta", cell: (service) => <span className="text-[13px]">{formatDate(service.valid_to)}</span> },
    { id: "state", header: "Estado", cell: (service) => <Badge tone={SUPPLY_STATE[service.state].tone}>{SUPPLY_STATE[service.state].label}</Badge> },
  ];
  const metrics: MetricFilter<ServiceItem>[] = [
    { id: "active", label: "Vigentes", tone: "ok", icon: <CircleCheck size={19} />, matches: (service) => service.state === "activo" },
    { id: "off", label: "Vencidos o inactivos", tone: "mute", icon: <CircleSlash size={19} />, matches: (service) => service.state !== "activo" },
  ];
  return (
    <DataTable
      screen="proveedor-servicios"
      rows={detail.services}
      columns={columns}
      getKey={(service) => service.ref}
      entityLabel="servicios"
      searchText={(service) => `${service.ref} ${service.name} ${service.type}`}
      searchPlaceholder="Buscar servicio"
      metrics={metrics}
      emptyTitle="Sin servicios registrados"
      csv={{
        fileName: `servicios-${detail.provider.ref}`,
        columns: [
          { header: "Código", value: (service) => service.ref },
          { header: "Servicio", value: (service) => service.name },
          { header: "Tipo", value: (service) => service.type },
          { header: "Unidad", value: (service) => service.unit },
          ...(seesCost ? [{ header: "Costo", value: (service: ServiceItem) => service.cost }, { header: "Moneda", value: (service: ServiceItem) => service.currency }] : []),
          { header: "Vigente hasta", value: (service) => service.valid_to },
          { header: "Estado", value: (service) => SUPPLY_STATE[service.state].label },
        ],
      }}
    />
  );
}

export function ProviderProductsTable({ detail }: { detail: ProviderDetail }) {
  const columns: Column<ProductItem>[] = [
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (product) => (
        <Link href={`/catalogo/productos/${product.code}`} className="block min-w-0">
          <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{product.name}</span>
          <small className="font-mono text-[11.5px] text-fg-3">{product.code}</small>
        </Link>
      ),
    },
    { id: "role", header: "Participa como", cell: (product) => <span className="inline-flex items-center gap-1.5 text-[13px]">{product.role === "principal" ? <Crown size={14} className="text-[var(--t2)]" /> : <Puzzle size={14} className="text-fg-3" />}{product.role === "principal" ? "Proveedor principal" : "Componente"}</span> },
    { id: "status", header: "Estado", cell: (product) => <StatusBadge status={product.status} label={productLabel(product.status)} /> },
  ];
  const metrics: MetricFilter<ProductItem>[] = [
    { id: "main", label: "Principal", tone: "sun", icon: <Crown size={19} />, matches: (product) => product.role === "principal" },
    { id: "component", label: "Componente", tone: "t1", icon: <Puzzle size={19} />, matches: (product) => product.role === "componente" },
  ];
  return (
    <DataTable
      screen="proveedor-productos"
      rows={detail.products}
      columns={columns}
      getKey={(product) => product.code}
      entityLabel="productos"
      searchText={(product) => `${product.code} ${product.name}`}
      searchPlaceholder="Buscar producto"
      metrics={metrics}
      emptyTitle="No participa en ningún producto"
      csv={{
        fileName: `productos-${detail.provider.ref}`,
        columns: [
          { header: "Código", value: (product) => product.code },
          { header: "Producto", value: (product) => product.name },
          { header: "Participa como", value: (product) => (product.role === "principal" ? "Proveedor principal" : "Componente") },
          { header: "Estado", value: (product) => productLabel(product.status) },
        ],
      }}
    />
  );
}

export function ProviderReservationsTable({ detail }: { detail: ProviderDetail }) {
  const rows = detail.reservations ?? [];
  const seesCost = rows.some((row) => row.cost !== null);
  const columns: Column<ReservationItem>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <Link href={`/reservas/${row.code}`} className="block min-w-0">
          <span className="block truncate font-semibold transition-colors hover:text-accent hover:underline">{row.code}</span>
          <small className="block truncate text-xs text-fg-3">{row.client}</small>
        </Link>
      ),
    },
    { id: "service", header: "Servicio", cell: (row) => <span className="block max-w-[280px] truncate text-[13px]">{row.service}<small className="block text-xs text-fg-3">{row.pax} pax</small></span> },
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{formatDate(row.date)}</span> },
    { id: "confirmation", header: "Confirmación", wideOnly: true, cell: (row) => <span className="font-mono text-[12.5px] text-fg-2">{row.confirmation_code ?? "—"}</span> },
    ...(seesCost ? [{ id: "cost", header: "Costo", align: "right" as const, cell: (row: ReservationItem) => <b className="font-mono text-[13px]">{row.cost === null ? "—" : formatMoney(Number(row.cost), row.currency)}</b> }] : []),
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
  ];
  const metrics: MetricFilter<ReservationItem>[] = [
    { id: "upcoming", label: "Próximos", tone: "t1", icon: <Hourglass size={19} />, matches: (row) => row.date >= detail.today && row.status !== "cancelado" },
    { id: "pending", label: "Por confirmar", tone: "sun", icon: <CircleAlert size={19} />, matches: (row) => ["solicitado", "pendiente"].includes(row.status) },
    { id: "confirmed", label: "Confirmados", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => ["confirmado", "completado"].includes(row.status) },
  ];
  return (
    <DataTable
      screen="proveedor-reservas"
      rows={rows}
      columns={columns}
      getKey={(row) => row.service_code}
      entityLabel="servicios reservados"
      searchText={(row) => `${row.code} ${row.client} ${row.service} ${row.confirmation_code ?? ""}`}
      searchPlaceholder="Buscar reserva, cliente o servicio"
      metrics={metrics}
      emptyTitle="Sin reservas con este proveedor"
      csv={{
        fileName: `reservas-${detail.provider.ref}`,
        columns: [
          { header: "Reserva", value: (row) => row.code },
          { header: "Cliente", value: (row) => row.client },
          { header: "Servicio", value: (row) => row.service },
          { header: "Fecha", value: (row) => row.date },
          { header: "Pax", value: (row) => row.pax },
          { header: "Confirmación", value: (row) => row.confirmation_code },
          ...(seesCost ? [{ header: "Costo", value: (row: ReservationItem) => row.cost }, { header: "Moneda", value: (row: ReservationItem) => row.currency }] : []),
          { header: "Estado", value: (row) => row.status },
        ],
      }}
    />
  );
}

export function ProviderPayablesTable({ detail }: { detail: ProviderDetail }) {
  const rows = detail.payables ?? [];
  const columns: Column<PayableItem>[] = [
    { id: "code", header: "Documento", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block font-mono text-[13px] font-semibold">{row.code}</b><small className="block max-w-[260px] truncate text-xs text-fg-3">{row.concept}</small></span> },
    { id: "reservation", header: "Reserva", cell: (row) => (row.reservation ? <Link href={`/reservas/${row.reservation}`} className="font-mono text-[13px] text-accent hover:underline">{row.reservation}</Link> : <span className="text-fg-3">—</span>) },
    { id: "due", header: "Vence", cell: (row) => <span className={cn("text-[13px]", row.overdue && "font-semibold text-bad")}>{row.due_date ? formatDate(row.due_date) : "—"}{row.overdue && <small className="block text-xs font-normal">Vencida</small>}</span> },
    { id: "amount", header: "Monto", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(Number(row.amount), row.currency)}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (row) => <b className="font-mono text-[13px]">{formatMoney(Number(row.balance), row.currency)}</b> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
  ];
  const metrics: MetricFilter<PayableItem>[] = [
    { id: "open", label: "Con saldo", tone: "sun", icon: <Hourglass size={19} />, matches: (row) => Number(row.balance) > 0 },
    { id: "overdue", label: "Vencidas", tone: "bad", icon: <CircleAlert size={19} />, matches: (row) => row.overdue },
    { id: "paid", label: "Pagadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "pagada" },
  ];
  return (
    <DataTable
      screen="proveedor-cxp"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="cuentas por pagar"
      searchText={(row) => `${row.code} ${row.reservation ?? ""} ${row.concept}`}
      searchPlaceholder="Buscar documento o reserva"
      metrics={metrics}
      emptyTitle="Sin cuentas por pagar"
      csv={{
        fileName: `cuentas-por-pagar-${detail.provider.ref}`,
        columns: [
          { header: "Documento", value: (row) => row.code },
          { header: "Reserva", value: (row) => row.reservation },
          { header: "Concepto", value: (row) => row.concept },
          { header: "Vence", value: (row) => row.due_date },
          { header: "Monto", value: (row) => row.amount },
          { header: "Saldo", value: (row) => row.balance },
          { header: "Moneda", value: (row) => row.currency },
          { header: "Estado", value: (row) => row.status },
        ],
      }}
    />
  );
}
