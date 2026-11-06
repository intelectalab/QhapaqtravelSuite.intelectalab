"use client";

import { CircleCheck, Flame, Gauge } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { planTone, type PlanMetric } from "@/lib/platform";
import type { UsageItem, UsageMetric } from "@/lib/platformBilling";
import { PLAN_LIMITS } from "./planLimits";

const SHOWN: PlanMetric[] = ["users", "storage_gb", "reservations_month", "whatsapp_month", "email_month", "api_calls_month"];

const info = (metric: PlanMetric) => PLAN_LIMITS.find((limit) => limit.metric === metric);

const level = (pct: number | null) => (pct === null ? "bg-fg-3/40" : pct >= 100 ? "bg-bad" : pct >= 80 ? "bg-warn" : "bg-ok");

const compact = (value: number) => (value >= 10_000 ? `${formatNumber(Math.round(value / 1000))} mil` : formatNumber(value));

function Meter({ metric }: { metric: UsageMetric | undefined }) {
  if (!metric) return null;
  const meta = info(metric.metric);
  const unit = meta?.unit ? ` ${meta.unit}` : "";
  const limit = metric.limit === null ? "sin tope" : metric.limit === 0 ? "no incluido" : `${compact(metric.limit)}${unit}`;
  return (
    <div className="group w-full min-w-[96px]" title={`${meta?.label ?? metric.metric}: ${formatNumber(metric.value)}${unit} de ${limit}${metric.pct !== null ? ` (${metric.pct} %)` : ""}`}>
      <p className="mb-1 font-mono text-[12.5px]">
        <b className="font-semibold">{compact(metric.value)}</b>
        <span className="text-fg-3"> / {limit}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className={cn("block h-full origin-left rounded-full transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]", level(metric.pct))} style={{ width: `${metric.pct === null ? 100 : Math.min(100, Math.max(metric.pct, 2))}%`, opacity: metric.pct === null ? 0.35 : 1 }} />
      </div>
    </div>
  );
}

const find = (item: UsageItem, metric: PlanMetric) => item.metrics.find((entry) => entry.metric === metric);

const columns: Column<UsageItem>[] = [
  {
    id: "tenant",
    header: "Agencia",
    mobile: "title",
    cell: (item) => (
      <Link href={`/plataforma/agencias/${item.code}`} className="flex items-center gap-2.5 hover:underline">
        <Avatar name={item.name} />
        <span className="min-w-0">
          <b className="block truncate text-[13.5px] font-semibold">{item.name}</b>
          <span className="mt-0.5 flex items-center gap-1.5">
            <Badge tone={planTone(item.plan.rank)} dot={false}>
              {item.plan.name}
            </Badge>
            {item.status !== "activo" && <StatusBadge status={item.status} />}
          </span>
        </span>
      </Link>
    ),
  },
  ...SHOWN.map(
    (metric, index): Column<UsageItem> => ({
      id: metric,
      header: info(metric)?.label ?? metric,
      wideOnly: index > 2,
      cell: (item) => <Meter metric={find(item, metric)} />,
    }),
  ),
  {
    id: "top",
    header: "Más cerca del límite",
    mobile: "detail",
    cell: (item) =>
      item.top ? (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", item.top.pct !== null && item.top.pct >= 80 ? "bg-warn/12 text-warn" : "bg-surface-2 text-fg-2")}>
          {info(item.top.metric)?.label ?? item.top.metric} · {item.top.pct} %
        </span>
      ) : (
        <span className="text-[12.5px] text-fg-3">Sin límites</span>
      ),
  },
];

const metrics: MetricFilter<UsageItem>[] = [
  { id: "alert", label: "Con aviso de consumo", tone: "warn", icon: <Flame size={19} />, matches: (item) => item.alert !== null },
  { id: "limit", label: "Al límite o encima", tone: "bad", icon: <Gauge size={19} />, matches: (item) => (item.top?.pct ?? 0) >= 100 },
  { id: "ok", label: "Holgadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (item) => (item.top?.pct ?? 0) < 80 },
];

const sorts: SortOption<UsageItem>[] = [
  { id: "top", label: "Mayor consumo", type: "number", value: (item) => item.top?.pct ?? 0 },
  { id: "name", label: "Nombre", type: "text", value: (item) => item.name },
];

export function UsageTable({ items }: { items: UsageItem[] }) {
  const filters: FilterConfig<UsageItem>[] = [{ id: "plan", label: "Plan", options: [...new Set(items.map((item) => item.plan.name))].map((value) => ({ value, label: value })), value: (item) => item.plan.name }];

  return <DataTable screen="plataforma-uso" rows={items} columns={columns} getKey={(item) => item.code} entityLabel="agencias" searchText={(item) => `${item.name} ${item.code}`} searchPlaceholder="Buscar agencia" metrics={metrics} filters={filters} sorts={sorts} />;
}
