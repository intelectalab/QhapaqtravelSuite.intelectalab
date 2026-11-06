"use client";

import { CircleCheck, CircleSlash, FileClock, Star } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { DetailPanel, PanelSection } from "@/features/catalog-shared/CatalogPanels";
import type { ProviderRow, ProvidersOverview } from "@/lib/catalog-providers";
import { SUPPLY_STATE } from "@/lib/catalog-services";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { ProviderContacts, ProviderEditAction, ProviderToggleAction } from "./ProviderForms";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

function Rating({ value }: { value: number }) {
  if (!value) return <span className="text-[12.5px] text-fg-3">Sin calificar</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold" title={`${value.toFixed(1)} de 5`}>
      <Star size={14} className="fill-[var(--t2)] text-[var(--t2)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" />
      {value.toFixed(1)}
    </span>
  );
}

function ContractCell({ provider }: { provider: ProviderRow }) {
  const days = provider.contract_days;
  return (
    <span className="text-[13px]">
      hasta {formatDate(provider.contract_end)}
      <small className={cn("block text-xs", days < 0 ? "text-bad" : days <= 95 ? "text-warn" : "text-fg-3")}>{days < 0 ? `Venció hace ${-days} días` : days === 0 ? "Vence hoy" : `${days} días`}</small>
    </span>
  );
}

function ProviderDetail({ provider, overview, asName }: { provider: ProviderRow; overview: ProvidersOverview; asName?: boolean }) {
  return (
    <DetailPanel
      title={provider.name}
      description={`${provider.ref} · ${provider.type}${provider.city ? ` · ${provider.city}` : ""}`}
      trigger={
        asName
          ? (open) => (
              <button type="button" onClick={open} className="group flex min-w-0 items-center gap-2.5 text-left">
                <Avatar name={provider.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold transition-colors group-hover:text-accent group-hover:underline">{provider.name}</span>
                  <small className="block truncate text-xs text-fg-3">{provider.type}{provider.city ? ` · ${provider.city}` : ""}</small>
                </span>
              </button>
            )
          : undefined
      }
    >
      <FieldList
        fields={[
          { label: "Estado", value: <Badge tone={SUPPLY_STATE[provider.state].tone}>{SUPPLY_STATE[provider.state].label}</Badge> },
          { label: "RUC", value: <span className="font-mono">{provider.ruc}</span> },
          { label: "Contrato", value: `${formatDate(provider.contract_start)} – ${formatDate(provider.contract_end)}` },
          { label: "Moneda", value: provider.currency },
          { label: "Pago", value: provider.payment_terms ?? "—" },
          { label: "Calificación", value: <Rating value={provider.rating} /> },
        ]}
      />
      {provider.rating_note && <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{provider.rating_note}</p>}
      <ProviderContacts provider={provider} manage={overview.can.manage} />
      <PanelSection title={`Servicios (${provider.services.length})`}>
        {provider.services.length ? (
          <ul className="flex flex-col gap-1">
            {provider.services.map((service) => (
              <li key={service.ref} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] transition hover:bg-surface-2">
                <span className="min-w-0 truncate">{service.name}</span>
                <span className="flex-none text-[12px] text-fg-3">{service.type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-fg-3">Sin servicios registrados.</p>
        )}
      </PanelSection>
      {provider.products.length > 0 && (
        <PanelSection title={`Proveedor principal de (${provider.products.length})`}>
          <ul className="flex flex-col gap-1">
            {provider.products.map((product) => (
              <li key={product.code}>
                <Link href={`/catalogo/productos/${product.code}`} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition hover:bg-surface-2">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-mono text-[11.5px] text-fg-3">{product.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </DetailPanel>
  );
}

export function ProvidersTable({ overview }: { overview: ProvidersOverview }) {
  const { can } = overview;
  const columns: Column<ProviderRow>[] = [
    { id: "provider", header: "Proveedor", mobile: "title", cell: (provider) => <ProviderDetail provider={provider} overview={overview} asName /> },
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
          <ProviderDetail provider={provider} overview={overview} />
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
  return <DataTable screen="proveedores" rows={overview.providers} columns={columns} getKey={(provider) => provider.ref} entityLabel="proveedores" searchText={(provider) => `${provider.ref} ${provider.name} ${provider.ruc} ${provider.type} ${provider.city ?? ""} ${provider.contact_name}`} searchPlaceholder="Buscar nombre, RUC o ciudad" metrics={metrics} filters={filters} sorts={sorts} />;
}
