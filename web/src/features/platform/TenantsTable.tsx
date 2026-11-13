"use client";

import { CircleCheck, CirclePause, Hourglass } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { formatBytes, type TenantSummary } from "@/lib/platform";
import { TenantStatusAction } from "./TenantStatusAction";

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
  { id: "modules", header: "Módulos", align: "right", wideOnly: true, cell: (tenant) => <span className="font-mono text-[13px]">{tenant.modules}</span> },
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
      <RowActions>
        <RowIcon tone="view" label="Ver ficha" href={tenantHref(tenant)} />
        <RowIcon tone="edit" label="Editar" href={`${tenantHref(tenant)}?editar=1`} />
        <TenantStatusAction tenant={tenant} iconOnly />
      </RowActions>
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

const STATUS_LABEL: Record<TenantSummary["status"], string> = { activo: "Activa", prueba: "En prueba", suspendido: "Suspendida" };

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function TenantsTable({ tenants, initialPlan }: { tenants: TenantSummary[]; initialPlan?: string }) {
  const filters: FilterConfig<TenantSummary>[] = [
    { id: "plan", label: "Plan", options: unique(tenants.map((tenant) => tenant.plan?.name ?? "Sin plan")), value: (tenant) => tenant.plan?.name ?? "Sin plan" },
    { id: "status", label: "Estado", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })), value: (tenant) => tenant.status },
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
      initialFilters={initialPlan ? { plan: initialPlan } : undefined}
      footer={(rows) => ({
        tenant: `Total (${rows.length})`,
        users: <span className="font-mono">{rows.reduce((sum, tenant) => sum + tenant.users, 0)}</span>,
        sedes: <span className="font-mono">{rows.reduce((sum, tenant) => sum + tenant.sedes, 0)}</span>,
        storage: <span className="font-mono">{formatBytes(rows.reduce((sum, tenant) => sum + tenant.storage_used_bytes, 0))}</span>,
        mrr: <span className="font-mono">{formatMoney(rows.reduce((sum, tenant) => sum + Number(tenant.mrr), 0))}</span>,
      })}
    />
  );
}
