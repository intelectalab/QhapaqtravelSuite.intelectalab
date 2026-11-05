"use client";

import { CircleCheck, CircleOff, Eye, Hourglass, Infinity as InfinityIcon, Ticket } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { PLAN_STATUS, planTone, tenantTotal, type PlanSummary } from "@/lib/platform";
import { toneStyle } from "@/lib/tone";
import { KEY_LIMITS, limitValue } from "./planLimits";

const planHref = (plan: PlanSummary) => `/plataforma/planes/${plan.code}`;

const columns: Column<PlanSummary>[] = [
  {
    id: "plan",
    header: "Plan",
    mobile: "title",
    cell: (plan) => (
      <div className="flex items-center gap-3">
        <span style={toneStyle(planTone(plan.rank))} className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[var(--tint)] text-white shadow-[0_6px_14px_-8px_var(--tint)]">
          <Ticket size={17} />
        </span>
        <div className="min-w-0">
          <Link href={planHref(plan)} className="font-semibold hover:underline">
            {plan.name}
          </Link>
          <small className="block text-xs text-fg-3">{tenantTotal(plan) === 1 ? "1 agencia" : `${tenantTotal(plan)} agencias`}</small>
        </div>
      </div>
    ),
  },
  { id: "month", header: "Precio mensual", align: "right", cell: (plan) => <span className="font-mono text-[13px] font-semibold">{formatMoney(plan.price_month, plan.currency)}</span> },
  { id: "year", header: "Precio anual", align: "right", wideOnly: true, cell: (plan) => <span className="font-mono text-[13px] text-fg-2">{formatMoney(plan.price_year, plan.currency)}</span> },
  { id: "modules", header: "Módulos", cell: (plan) => <Badge tone={planTone(plan.rank)} dot={false}>{plan.module_count === 1 ? "1 módulo" : `${plan.module_count} módulos`}</Badge> },
  {
    id: "rules",
    header: "Reglas de reserva",
    wideOnly: true,
    cell: (plan) => (
      <span className="flex items-center gap-2 text-[13px]">
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
          <span style={{ ...toneStyle(planTone(plan.rank)), width: `${(plan.rules_included / Math.max(plan.rules_total, 1)) * 100}%` }} className="block h-full rounded-full bg-[var(--tint)]" />
        </span>
        <span className="font-mono">{plan.rules_included}/{plan.rules_total}</span>
      </span>
    ),
  },
  {
    id: "limits",
    header: "Límites clave",
    cell: (plan) => (
      <span className="flex items-center gap-3.5 whitespace-nowrap text-[13px]">
        {KEY_LIMITS.map((info) => {
          const value = limitValue(plan, info);
          const Icon = info.icon;
          return (
            <span key={info.metric} title={`${info.label}: ${value.unlimited ? "sin límite" : value.text}`} className="flex items-center gap-1">
              <Icon size={14} style={toneStyle(info.tone)} className="text-[var(--tint)]" />
              {value.unlimited ? <InfinityIcon size={15} className="text-accent" /> : <span className="font-medium">{value.text.replace(" GB", "")}</span>}
            </span>
          );
        })}
      </span>
    ),
  },
  {
    id: "trial",
    header: "Prueba",
    cell: (plan) => (plan.trial_days > 0 ? <Badge tone="info" dot={false}>{`${plan.trial_days} días`}</Badge> : <Badge dot={false}>No</Badge>),
  },
  { id: "status", header: "Estado", cell: (plan) => <Badge tone={PLAN_STATUS[plan.status].tone}>{PLAN_STATUS[plan.status].label}</Badge> },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (plan) => (
      <Link href={planHref(plan)} aria-label={`Ver el plan ${plan.name}`} title="Ver detalle" className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] bg-accent/10 text-accent">
        <Eye size={16} />
      </Link>
    ),
  },
];

const metrics: MetricFilter<PlanSummary>[] = [
  { id: "active", label: "Disponibles", tone: "ok", icon: <CircleCheck size={19} />, matches: (plan) => plan.status === "active" },
  { id: "inactive", label: "No disponibles", tone: "mute", icon: <CircleOff size={19} />, matches: (plan) => plan.status !== "active" },
  { id: "trial", label: "Con prueba gratis", tone: "info", icon: <Hourglass size={19} />, matches: (plan) => plan.trial_days > 0 },
];

const sorts: SortOption<PlanSummary>[] = [
  { id: "name", label: "Nombre", type: "text", value: (plan) => plan.name },
  { id: "month", label: "Precio mensual", type: "number", value: (plan) => Number(plan.price_month) },
  { id: "year", label: "Precio anual", type: "number", value: (plan) => Number(plan.price_year) },
  { id: "tenants", label: "Agencias", type: "number", value: (plan) => tenantTotal(plan) },
];

export function PlansTable({ plans }: { plans: PlanSummary[] }) {
  return (
    <DataTable
      screen="plataforma-planes"
      rows={plans}
      columns={columns}
      getKey={(plan) => plan.id}
      entityLabel="planes"
      searchText={(plan) => `${plan.name} ${plan.code}`}
      searchPlaceholder="Buscar plan"
      metrics={metrics}
      filters={[
        {
          id: "status",
          label: "Estado",
          options: Object.entries(PLAN_STATUS).map(([value, status]) => ({ value, label: status.label })),
          value: (plan) => plan.status,
        },
      ]}
      sorts={sorts}
    />
  );
}
