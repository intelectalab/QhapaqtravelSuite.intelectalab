"use client";

import { Building2, CircleCheck, CirclePause, Clock } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { num, type CorporateAccount } from "@/lib/corporate";
import { formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";

const STATUS_TONE: Record<CorporateAccount["status"], Tone> = { activa: "ok", suspendida: "warn", cerrada: "mute" };

export function CorporateAccountsTable({ accounts }: { accounts: CorporateAccount[] }) {
  const columns: Column<CorporateAccount>[] = [
    {
      id: "client",
      header: "Empresa",
      mobile: "title",
      cell: (row) => (
        <Link href={`/crm/cuentas-corporativas/${row.id}`} className="min-w-0 hover:underline">
          <b className="block font-semibold">{row.client.name}</b>
          <small className="block text-xs text-fg-3">
            {row.client.code} · RUC {row.client.doc_number}
          </small>
        </Link>
      ),
    },
    {
      id: "terms",
      header: "Condiciones",
      cell: (row) => (
        <span className="text-[12.5px] text-fg-2">
          Crédito {row.credit_days} días
          <small className="block text-fg-3">{row.require_approval && row.approval_threshold ? `Aprobación desde ${formatMoney(row.approval_threshold, row.currency, { compact: true })}` : "Sin aprobación previa"}</small>
        </span>
      ),
    },
    {
      id: "team",
      header: "Estructura",
      wideOnly: true,
      cell: (row) => (
        <span className="text-[12.5px] text-fg-2">
          {row.counts.cost_centers} centros · {row.counts.travelers} viajeros
          <small className="block text-fg-3">{row.counts.portal_users} usuarios del panel</small>
        </span>
      ),
    },
    { id: "year", header: "Comprado en el año", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.purchases_year, row.currency)}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (row) => <b className={num(row.balance) > 0 ? "font-mono text-[13px] text-warn" : "font-mono text-[13px]"}>{formatMoney(row.balance, row.currency)}</b> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5">
          <Badge tone={STATUS_TONE[row.status]}>{row.status_label}</Badge>
          {row.counts.pending_approvals > 0 && <small className="text-[11.5px] text-warn">{row.counts.pending_approvals} por aprobar</small>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver cuenta" href={`/crm/cuentas-corporativas/${row.id}`} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<CorporateAccount>[] = [
    { id: "activa", label: "Activas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "activa" },
    { id: "suspendida", label: "Suspendidas", tone: "warn", icon: <CirclePause size={19} />, matches: (row) => row.status === "suspendida" },
    { id: "aprobaciones", label: "Con aprobaciones pendientes", tone: "info", icon: <Clock size={19} />, matches: (row) => row.counts.pending_approvals > 0 },
    { id: "saldo", label: "Con saldo por cobrar", tone: "t1", icon: <Building2 size={19} />, matches: (row) => num(row.balance) > 0 },
  ];
  const filters: FilterConfig<CorporateAccount>[] = [{ id: "status", label: "Estado", options: [{ value: "activa", label: "Activa" }, { value: "suspendida", label: "Suspendida" }, { value: "cerrada", label: "Cerrada" }], value: (row) => row.status }];
  const sorts: SortOption<CorporateAccount>[] = [
    { id: "name", label: "Empresa", type: "text", value: (row) => row.client.name },
    { id: "balance", label: "Saldo", type: "number", value: (row) => num(row.balance) },
    { id: "year", label: "Comprado en el año", type: "number", value: (row) => num(row.purchases_year) },
  ];
  return <DataTable screen="crm-cuentas-corporativas" rows={accounts} columns={columns} getKey={(row) => row.id} entityLabel="cuentas" searchText={(row) => `${row.client.name} ${row.client.code} ${row.client.doc_number}`} searchPlaceholder="Buscar empresa o RUC" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay cuentas corporativas" />;
}
