"use client";

import { CircleCheck, CircleSlash, FileClock, Star } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { ProviderRow, ProvidersOverview } from "@/lib/catalog-providers";
import { SUPPLY_STATE } from "@/lib/catalog-services";
import { cn } from "@/lib/cn";
import type { CsvExport } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ProviderEditAction, ProviderToggleAction } from "./ProviderForms";

export const providerHref = (ref: string) => `/catalogo/proveedores/${encodeURIComponent(ref)}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function Rating({ value }: { value: number }) {
  if (!value) return <span className="text-[12.5px] text-fg-3">Sin calificar</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold" title={`${value.toFixed(1)} de 5`}>
      <Star size={14} className="fill-[var(--t2)] text-[var(--t2)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" />
      {value.toFixed(1)}
    </span>
  );
}

export function ContractCell({ provider }: { provider: Pick<ProviderRow, "contract_days" | "contract_end"> }) {
  const days = provider.contract_days;
  return (
    <span className="text-[13px]">
      hasta {formatDate(provider.contract_end)}
      <small className={cn("block text-xs", days < 0 ? "text-bad" : days <= 95 ? "text-warn" : "text-fg-3")}>{days < 0 ? `Venció hace ${-days} días` : days === 0 ? "Vence hoy" : `${days} días`}</small>
    </span>
  );
}

export function ProvidersTable({ overview }: { overview: ProvidersOverview }) {
  const { can } = overview;
  const columns: Column<ProviderRow>[] = [
    {
      id: "provider",
      header: "Proveedor",
      mobile: "title",
      cell: (provider) => (
        <Link href={providerHref(provider.ref)} className="group flex min-w-0 items-center gap-2.5">
          <Avatar name={provider.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold transition-colors group-hover:text-accent group-hover:underline">{provider.name}</span>
            <small className="block truncate text-xs text-fg-3">{provider.type}{provider.city ? ` · ${provider.city}` : ""}</small>
          </span>
        </Link>
      ),
    },
    { id: "contact", header: "Contacto", wideOnly: true, cell: (provider) => <span className="text-[13px]">{provider.contact_name}<small className="block text-xs text-fg-3">{provider.phone ?? provider.email ?? "—"}</small></span> },
    { id: "contract", header: "Contrato", cell: (provider) => <ContractCell provider={provider} /> },
    { id: "services", header: "Servicios", align: "right", wideOnly: true, cell: (provider) => <span className="font-mono text-[13px] font-semibold">{provider.services.length}</span> },
    { id: "rating", header: "Calificación", cell: (provider) => <Rating value={provider.rating} /> },
    { id: "state", header: "Estado", cell: (provider) => <Badge tone={SUPPLY_STATE[provider.state].tone}>{SUPPLY_STATE[provider.state].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (provider) => (
        <RowActions>
          <RowIcon tone="view" label="Ver ficha" href={providerHref(provider.ref)} />
          {can.manage && <ProviderEditAction overview={overview} provider={provider} />}
          {can.manage && <ProviderToggleAction provider={provider} />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ProviderRow>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, matches: (provider) => provider.state === "activo" },
    { id: "expiring", label: "Contrato por vencer", tone: "sun", icon: <FileClock size={19} />, matches: (provider) => provider.contract_days >= 0 && provider.contract_days <= 95 },
    { id: "off", label: "Vencidos o inactivos", tone: "bad", icon: <CircleSlash size={19} />, matches: (provider) => provider.state !== "activo" },
  ];
  const filters: FilterConfig<ProviderRow>[] = [
    { id: "type", label: "Tipo", options: unique(overview.providers.map((provider) => provider.type)), value: (provider) => provider.type },
    { id: "city", label: "Ciudad", options: unique(overview.providers.map((provider) => provider.city ?? "Sin ciudad")), value: (provider) => provider.city ?? "Sin ciudad" },
    { id: "state", label: "Estado", options: Object.entries(SUPPLY_STATE).map(([value, item]) => ({ value, label: item.label })), value: (provider) => provider.state },
  ];
  const sorts: SortOption<ProviderRow>[] = [
    { id: "name", label: "Nombre", type: "text", value: (provider) => provider.name },
    { id: "contract", label: "Fin de contrato", type: "date", value: (provider) => provider.contract_end },
    { id: "rating", label: "Calificación", type: "number", value: (provider) => provider.rating },
  ];
  const csv: CsvExport<ProviderRow> = {
    fileName: "proveedores",
    columns: [
      { header: "Código", value: (provider) => provider.ref },
      { header: "Razón social", value: (provider) => provider.name },
      { header: "RUC", value: (provider) => provider.ruc },
      { header: "Tipo", value: (provider) => provider.type },
      { header: "Ciudad", value: (provider) => provider.city },
      { header: "Contacto", value: (provider) => provider.contact_name },
      { header: "Teléfono", value: (provider) => provider.phone },
      { header: "Correo", value: (provider) => provider.email },
      { header: "Inicio de contrato", value: (provider) => provider.contract_start },
      { header: "Fin de contrato", value: (provider) => provider.contract_end },
      { header: "Moneda", value: (provider) => provider.currency },
      { header: "Condiciones de pago", value: (provider) => provider.payment_terms },
      { header: "Servicios", value: (provider) => provider.services.length },
      { header: "Calificación", value: (provider) => (provider.rating ? provider.rating.toFixed(1) : null) },
      { header: "Estado", value: (provider) => SUPPLY_STATE[provider.state].label },
    ],
  };
  return <DataTable screen="proveedores" rows={overview.providers} columns={columns} getKey={(provider) => provider.ref} entityLabel="proveedores" searchText={(provider) => `${provider.ref} ${provider.name} ${provider.ruc} ${provider.type} ${provider.city ?? ""} ${provider.contact_name}`} searchPlaceholder="Buscar nombre, RUC o ciudad" metrics={metrics} filters={filters} sorts={sorts} csv={csv} />;
}
