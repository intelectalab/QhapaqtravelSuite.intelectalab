"use client";

import { CalendarRange, ChartColumn, Layers, ShoppingBag, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/ui/Charts";
import { Select } from "@/components/ui/Select";
import { UsageBar } from "@/features/channels/ChannelUi";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { budgetLabel, budgetTone, num, type CorporatePeriodOption, type CorporatePurchase, type CorporatePurchases, type CorporateSummary, type CostCenter } from "@/lib/corporate";
import { formatDate, formatMoney } from "@/lib/format";

export function CorporatePeriodPicker({ periods, value }: { periods: CorporatePeriodOption[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const options = periods.some((option) => option.value === value) ? periods : [{ value, label: value }, ...periods];
  return (
    <span className="flex items-center gap-2">
      <CalendarRange size={16} className="text-fg-3" />
      <Select
        ariaLabel="Período"
        value={value}
        options={options}
        className="min-w-[180px]"
        onChange={(next) => {
          const query = new URLSearchParams(params.toString());
          query.set("periodo", next);
          router.push(`${pathname}?${query.toString()}`, { scroll: false });
        }}
      />
    </span>
  );
}

export function CostCenterUsage({ center, currency, amount }: { center: CostCenter; currency: string; amount?: string }) {
  const pct = num(center.used_pct);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13.5px]">
          <b className="font-mono text-[12px] font-semibold text-fg-2">{center.code}</b> {center.name}
        </span>
        <span className="flex-none font-mono text-[13px] font-semibold">{formatMoney(amount ?? center.used, currency)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <UsageBar pct={center.budget_amount ? pct : 0} tone={budgetTone(center.budget_state)} />
        <span className="flex-none text-[11.5px] text-fg-3">{center.budget_amount ? `${pct.toFixed(0)} % de ${formatMoney(center.budget_amount, currency, { compact: true })}` : "Sin tope"}</span>
      </div>
      {(center.budget_state === "alerta" || center.budget_state === "excedido") && (
        <Badge tone={budgetTone(center.budget_state)} className="mt-1.5">
          {budgetLabel(center.budget_state)} · {center.budget_period_label.toLowerCase()}
        </Badge>
      )}
    </div>
  );
}

export function CorporateSummaryView({ summary, purchases }: { summary: CorporateSummary; purchases: CorporatePurchases }) {
  const cur = summary.currency;
  const months = summary.months.map((month) => ({ label: month.label, value: num(month.amount), caption: num(month.amount) > 0 ? formatMoney(month.amount, cur, { compact: true }) : "", detail: `${formatMoney(month.amount, cur)} · ${month.count} compras`, highlight: month.month >= summary.period.from.slice(0, 7) && month.month <= summary.period.to.slice(0, 7) }));
  const maxTraveler = Math.max(1, ...summary.travelers.map((row) => num(row.amount)));

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={ChartColumn} title={`Gasto por mes · ${summary.period.key.slice(0, 4)}`} aside={<span className="text-[12px] text-fg-3">En barra resaltada, el período elegido</span>}>
        <div className="scroll-thin overflow-x-auto">
          <div className="min-w-[560px]">
            <BarChart data={months} height={150} />
          </div>
        </div>
      </SectionCard>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <SectionCard icon={Layers} title="Gasto y presupuesto por centro de costo" aside={summary.cost_centers.length}>
          {summary.cost_centers.length === 0 ? (
            <EmptyLine>La empresa aún no tiene centros de costo.</EmptyLine>
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.cost_centers.map((center, index) => (
                <li key={center.id} style={rise(index)} className={cn("lift rounded-tile border border-line px-3.5 py-3", RISE)}>
                  <CostCenterUsage center={center} currency={cur} amount={center.period_amount} />
                  <p className="mt-1 text-[11.5px] text-fg-3">
                    Acumulado del año {formatMoney(center.year_amount ?? "0", cur)} · consumo del presupuesto {center.budget_period_label.toLowerCase()} {formatMoney(center.used, cur)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard icon={UserRound} title="Gasto por viajero" aside={summary.travelers.length}>
          {summary.travelers.length === 0 ? (
            <EmptyLine>Sin viajes en el período.</EmptyLine>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {summary.travelers.map((row, index) => (
                  <li key={row.name} style={rise(index)} className={cn("lift group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-tile px-2 py-1.5 hover:bg-surface-2", RISE)}>
                    <span className="truncate text-[13.5px] font-medium">{row.name}</span>
                    <span className="font-mono text-[12.5px] font-semibold">{formatMoney(row.amount, cur)}</span>
                    <span className="col-span-2 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full origin-left rounded-full bg-[color-mix(in_srgb,var(--t1)_80%,transparent)] transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(4, (num(row.amount) / maxTraveler) * 100)}%` }} />
                      </span>
                      <span className="w-16 text-right text-[11.5px] text-fg-3">{row.trips} {row.trips === 1 ? "viaje" : "viajes"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-fg-3">El costo de cada compra se reparte en partes iguales entre sus viajeros.</p>
            </>
          )}
        </SectionCard>
      </div>
      <SectionCard icon={ShoppingBag} title="Compras del período" aside={purchases.items.length}>
        <PurchasesTable data={purchases} centers={summary.cost_centers} />
      </SectionCard>
    </div>
  );
}

function PurchasesTable({ data, centers }: { data: CorporatePurchases; centers: CostCenter[] }) {
  const columns: Column<CorporatePurchase>[] = [
    { id: "date", header: "Compra", cell: (row) => <span className="text-[13px]">{formatDate(row.date)}</span> },
    {
      id: "trip",
      header: "Viaje",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">{row.title}</b>
          <small className="block text-xs text-fg-3">
            <span className="font-mono">{row.reservation}</span>
            {row.travel_from ? ` · viaja ${formatDate(row.travel_from)}` : ""} · {row.travelers.length} {row.travelers.length === 1 ? "viajero" : "viajeros"}
          </small>
        </span>
      ),
    },
    { id: "center", header: "Centro de costo", cell: (row) => <span className="font-mono text-[12.5px]" title={row.allocations.map((part) => `${part.cost_center} ${num(part.pct)} %`).join(" · ")}>{row.allocations.length > 1 ? `${row.cost_center} +${row.allocations.length - 1}` : (row.cost_center ?? "—")}</span> },
    { id: "amount", header: "Importe", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, data.currency)}</span> },
  ];
  const filters: FilterConfig<CorporatePurchase>[] = [{ id: "center", label: "Centro de costo", options: centers.map((center) => ({ value: center.code, label: `${center.code} · ${center.name}` })), value: (row) => row.allocations.map((part) => part.cost_center) }];
  const sorts: SortOption<CorporatePurchase>[] = [
    { id: "date", label: "Fecha de compra", type: "date", value: (row) => row.date },
    { id: "amount", label: "Importe", type: "number", value: (row) => num(row.amount) },
  ];
  return <DataTable screen="portal-corporativo-compras" rows={data.items} columns={columns} getKey={(row) => row.id} entityLabel="compras" searchText={(row) => `${row.reservation} ${row.title} ${row.cost_center ?? ""} ${row.travelers.join(" ")}`} searchPlaceholder="Buscar reserva, viaje o viajero" filters={filters} sorts={sorts} emptyTitle="Sin compras en el período" />;
}
