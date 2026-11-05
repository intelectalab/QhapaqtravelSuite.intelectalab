"use client";

import { CircleCheck, CirclePause, Eye, Hourglass } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { formatBytes, type TenantSummary } from "@/lib/platform";

const tenantHref = (tenant: TenantSummary) => `/plataforma/agencias/${tenant.code}`;

const columns: Column<TenantSummary>[] = [
  {
    id: "tenant",
    header: "Agencia",
    mobile: "title",
    cell: (tenant) => (
      <div className="flex items-center gap-3">
        <Avatar name={tenant.name} />
        <div className="min-w-0">
          <Link href={tenantHref(tenant)} className="font-semibold hover:underline">
            {tenant.name}
          </Link>
          <small className="block text-xs text-fg-3">
            {tenant.code} · RUC {tenant.ruc}
          </small>
        </div>
      </div>
    ),
  },
  { id: "plan", header: "Plan", cell: (tenant) => <Badge tone="t1" dot={false}>{tenant.plan?.name ?? "Sin plan"}</Badge> },
  { id: "users", header: "Usuarios", align: "right", cell: (tenant) => <span className="font-mono text-[13px]">{tenant.users}</span> },
  { id: "sedes", header: "Sedes", align: "right", wideOnly: true, cell: (tenant) => <span className="font-mono text-[13px]">{tenant.sedes}</span> },
  { id: "storage", header: "Almacenamiento", align: "right", wideOnly: true, cell: (tenant) => <span className="font-mono text-[13px]">{formatBytes(tenant.storage_used_bytes)}</span> },
  { id: "mrr", header: "Ingreso mensual", align: "right", cell: (tenant) => <span className="font-mono text-[13px]">{formatMoney(tenant.mrr)}</span> },
  { id: "since", header: "Alta", wideOnly: true, cell: (tenant) => (tenant.created_at ? formatDate(tenant.created_at) : "") },
  { id: "status", header: "Estado", cell: (tenant) => <StatusBadge status={tenant.status} /> },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (tenant) => (
      <Link href={tenantHref(tenant)} aria-label={`Ver ficha de ${tenant.name}`} title="Ver ficha" className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] bg-accent/10 text-accent">
        <Eye size={16} />
      </Link>
    ),
  },
];

const metrics: MetricFilter<TenantSummary>[] = [
  { id: "active", label: "Activas", tone: "ok", icon: <CircleCheck size={19} />, matches: (tenant) => tenant.status === "activo" },
  { id: "trial", label: "En prueba", tone: "info", icon: <Hourglass size={19} />, matches: (tenant) => tenant.status === "prueba" },
  { id: "suspended", label: "Suspendidas", tone: "bad", icon: <CirclePause size={19} />, matches: (tenant) => tenant.status === "suspendido" },
];

const sorts: SortOption<TenantSummary>[] = [
  { id: "name", label: "Nombre", type: "text", value: (tenant) => tenant.name },
  { id: "mrr", label: "Ingreso mensual", type: "number", value: (tenant) => Number(tenant.mrr) },
  { id: "users", label: "Usuarios", type: "number", value: (tenant) => tenant.users },
  { id: "since", label: "Fecha de alta", type: "date", value: (tenant) => tenant.created_at },
];

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function TenantsTable({ tenants }: { tenants: TenantSummary[] }) {
  const filters: FilterConfig<TenantSummary>[] = [
    { id: "plan", label: "Plan", options: unique(tenants.map((tenant) => tenant.plan?.name ?? "Sin plan")), value: (tenant) => tenant.plan?.name ?? "Sin plan" },
  ];

  return (
    <DataTable
      screen="plataforma-agencias"
      rows={tenants}
      columns={columns}
      getKey={(tenant) => tenant.id}
      entityLabel="agencias"
      searchText={(tenant) => `${tenant.name} ${tenant.legal_name} ${tenant.ruc} ${tenant.code} ${tenant.subdomain} ${tenant.admin_email}`}
      searchPlaceholder="Buscar agencia, RUC o correo"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
