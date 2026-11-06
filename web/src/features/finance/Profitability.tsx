"use client";

import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { ProfitabilityOverview, ProfitRow } from "@/lib/finance";
import { formatMoney, formatPercent } from "@/lib/format";
import { statusLabel } from "@/lib/tone";

const BAND = { ok: { tone: "ok", label: "En meta" }, warn: { tone: "warn", label: "Vigilar" }, bad: { tone: "bad", label: "Bajo mínimo" } } as const;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function MarginMeter({ row, target }: { row: ProfitRow; target: number }) {
  const width = Math.max(0, Math.min(100, (row.margin_pct / (target * 2)) * 100));
  return (
    <div className="group grid w-[140px] gap-1" title={`Meta ${target} %`}>
      <span className={cn("font-mono text-[13px] font-semibold", row.band === "ok" ? "text-ok" : row.band === "warn" ? "text-warn" : "text-bad")}>{formatPercent(row.margin_pct)}</span>
      <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className={cn("absolute inset-y-0 left-0 origin-left rounded-full transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]", row.band === "ok" ? "bg-ok" : row.band === "warn" ? "bg-warn" : "bg-bad")} style={{ width: `${width}%` }} />
        <span className="absolute inset-y-0 left-1/2 w-px bg-fg-3/60" />
      </span>
    </div>
  );
}

export function ProfitabilityTable({ data }: { data: ProfitabilityOverview }) {
  const { rows, target } = data;

  const columns: Column<ProfitRow>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/reservas/${row.code}`} className="font-semibold hover:underline">
            {row.title}
          </Link>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.client} · {row.owner}
          </small>
        </div>
      ),
    },
    { id: "income", header: "Ingreso", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.income_pen)}</span> },
    { id: "cost", header: "Costo", align: "right", cell: (row) => <span className="font-mono text-[13px] text-fg-2" title={row.extra_cost_pen > 0 ? `Incluye ${formatMoney(row.extra_cost_pen)} de costos adicionales aprobados` : undefined}>{formatMoney(row.cost_pen)}</span> },
    { id: "margin", header: "Margen bruto", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.margin_pen)}</span> },
    { id: "net", header: "Utilidad neta", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]" title={`Comisiones ${formatMoney(row.commissions_pen)}`}>{formatMoney(row.net_pen)}</span> },
    { id: "pct", header: "Margen", cell: (row) => <MarginMeter row={row} target={target} /> },
    { id: "band", header: "Semáforo", cell: (row) => <Badge tone={BAND[row.band].tone}>{BAND[row.band].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver reserva" href={`/reservas/${row.code}`} />
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<ProfitRow>[] = [
    { id: "ok", label: "En meta", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.band === "ok" },
    { id: "warn", label: "Vigilar", tone: "warn", icon: <CircleAlert size={19} />, matches: (row) => row.band === "warn" },
    { id: "bad", label: "Bajo mínimo", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.band === "bad" },
  ];

  const filters: FilterConfig<ProfitRow>[] = [
    { id: "owner", label: "Asesor", options: unique(rows.map((row) => row.owner)).map((value) => ({ value, label: value })), value: (row) => row.owner },
    { id: "channel", label: "Canal", options: unique(rows.map((row) => row.channel)).map((value) => ({ value, label: value })), value: (row) => row.channel },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
  ];

  const sorts: SortOption<ProfitRow>[] = [
    { id: "income", label: "Ingreso", type: "number", value: (row) => row.income_pen },
    { id: "margin", label: "Margen bruto", type: "number", value: (row) => row.margin_pen },
    { id: "pct", label: "Margen %", type: "number", value: (row) => row.margin_pct },
  ];

  return (
    <DataTable
      screen="finanzas-rentabilidad"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="reservas"
      searchText={(row) => `${row.code} ${row.title} ${row.client} ${row.owner}`}
      searchPlaceholder="Buscar reserva, cliente o asesor"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
