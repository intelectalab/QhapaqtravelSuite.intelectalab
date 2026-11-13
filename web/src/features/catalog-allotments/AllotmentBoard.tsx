"use client";

import { AlertTriangle, BedDouble, CalendarClock, ChevronLeft, ChevronRight, CircleCheck, Hourglass, Lock, TimerOff, TrainFront, Undo2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/MiniTable";
import { Select } from "@/components/ui/Select";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { ALERT_TYPE, ALLOTMENT_STATUS, KIND_LABEL, RECOMMENDATION, type AllotmentAlert, type AllotmentCell, type AllotmentGrid, type AllotmentPickup, type AllotmentRow, type AllotmentSummary, type AllotmentsOverview, type PickupRow } from "@/lib/catalog-allotments";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { CellButton, CellLegend, DayPanel, weekday } from "./AllotmentDay";
import { RunReleaseJobAction } from "./AllotmentForms";

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const detailHref = (code: string) => `/catalogo/cupos/${encodeURIComponent(code)}`;

function ContractName({ contract }: { contract: Pick<AllotmentSummary, "code" | "name" | "provider" | "unit"> }) {
  return (
    <Link href={detailHref(contract.code)} className="group/name block min-w-0">
      <b className="block truncate font-semibold transition-colors group-hover/name:text-accent group-hover/name:underline">{contract.provider.name}</b>
      <small className="block truncate text-xs text-fg-3">{contract.code} · {contract.name}</small>
    </Link>
  );
}

export function AllotmentGridView({ grid, canManage }: { grid: AllotmentGrid; canManage: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<{ contract: AllotmentSummary; cell: AllotmentCell } | null>(null);
  const go = (patch: Partial<{ from: string; kind: string; all: boolean }>) => {
    const next = { from: grid.from, kind: grid.kind ?? "", all: grid.all, ...patch };
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.kind) params.set("kind", next.kind);
    if (next.all) params.set("all", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <Button size="sm" icon={<ChevronLeft size={15} />} onClick={() => go({ from: addDays(grid.from, -7) })}>7 días</Button>
        <Button size="sm" onClick={() => go({ from: addDays(grid.today, -2) })}>Hoy</Button>
        <Button size="sm" onClick={() => go({ from: addDays(grid.from, 7) })}>
          7 días <ChevronRight size={15} />
        </Button>
        <div className="w-[160px]">
          <TextField label="Desde" type="date" value={grid.from} onChange={(event) => event.target.value && go({ from: event.target.value })} />
        </div>
        <div className="w-[170px]">
          <Select value={grid.kind ?? ""} onChange={(kind) => go({ kind })} ariaLabel="Tipo de cupo" options={[{ value: "", label: "Todos los tipos" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]} className="h-10 w-full" />
        </div>
        <div className="pb-1.5">
          <SwitchField label="Incluir liberados y vencidos" name="all" checked={grid.all} onCheckedChange={(all) => go({ all })} />
        </div>
      </div>
      {grid.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[220px] bg-surface text-left text-[12px] font-semibold text-fg-3">Contrato</th>
                {grid.dates.map((date) => (
                  <th key={date} className={`text-center text-[11.5px] font-semibold ${date === grid.today ? "text-accent" : "text-fg-3"}`}>
                    {weekday(date)}
                    <span className="block font-mono">{date.slice(8, 10)}/{date.slice(5, 7)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.code}>
                  <td className="sticky left-0 z-10 bg-surface pr-2 align-middle text-[13px]">
                    <ContractName contract={row} />
                    <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-fg-3">
                      <Badge tone={ALLOTMENT_STATUS[row.status].tone}>{ALLOTMENT_STATUS[row.status].label}</Badge>
                      {row.unit} · rel. {row.release_days} d
                    </span>
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.date} className="min-w-[58px]">
                      <CellButton cell={cell} today={grid.today} onClick={() => setOpen({ contract: row, cell })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[13.5px] text-fg-3">No hay contratos para estas fechas y filtros.</p>
      )}
      <CellLegend />
      {open && <DayPanel contract={open.contract} cell={open.cell} today={grid.today} canManage={canManage} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function ContractsTable({ overview }: { overview: AllotmentsOverview }) {
  const columns: Column<AllotmentRow>[] = [
    { id: "contract", header: "Proveedor y cupo", mobile: "title", cell: (row) => <ContractName contract={row} /> },
    { id: "kind", header: "Tipo", cell: (row) => <span className="text-[13px]">{KIND_LABEL[row.kind]}</span> },
    { id: "validity", header: "Vigencia", wideOnly: true, cell: (row) => <span className="text-[13px]">{formatDate(row.valid_from)} – {formatDate(row.valid_to)}</span> },
    { id: "base", header: "Bloqueo", align: "right", cell: (row) => <span className="font-mono text-[13px]"><b>{row.base_qty}</b> <small className="text-fg-3">{row.unit}</small></span> },
    { id: "release", header: "Release", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.release_days} d</span> },
    { id: "rate", header: "Tarifa neta", align: "right", cell: (row) => <span className="text-[13px]">{formatMoney(row.net_rate, row.currency)}<small className="block text-xs text-fg-3">{row.penalty_pct ? `Penalidad ${row.penalty_pct} %` : "Sin penalidad"}</small></span> },
    {
      id: "utilization",
      header: "Uso 30 días",
      cell: (row) =>
        row.utilization === null ? (
          <span className="text-fg-3">—</span>
        ) : (
          <div className="w-[110px]">
            <ProgressBar value={row.utilization} tone={row.utilization < 30 ? "warn" : "ok"} />
            <small className="mt-1 block font-mono text-[11.5px] text-fg-3">{row.utilization} % · {row.window.used}/{row.window.capacity}</small>
          </div>
        ),
    },
    { id: "penalties", header: "Penalidad devengada", align: "right", wideOnly: true, cell: (row) => (row.penalties ? <span className="text-[13px] font-semibold text-bad">{formatMoney(row.penalties, row.currency)}</span> : <span className="text-fg-3">—</span>) },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={ALLOTMENT_STATUS[row.status].tone}>{ALLOTMENT_STATUS[row.status].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver contrato" href={detailHref(row.code)} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<AllotmentRow>[] = [
    { id: "activo", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "activo" },
    { id: "en_release", label: "En release", tone: "sun", icon: <Hourglass size={19} />, matches: (row) => row.status === "en_release" },
    { id: "liberado", label: "Liberados", tone: "mute", icon: <Undo2 size={19} />, matches: (row) => row.status === "liberado" },
    { id: "vencido", label: "Vencidos", tone: "bad", icon: <TimerOff size={19} />, matches: (row) => row.status === "vencido" },
  ];
  const filters: FilterConfig<AllotmentRow>[] = [
    { id: "kind", label: "Tipo", options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })), value: (row) => row.kind },
    { id: "status", label: "Estado", options: Object.entries(ALLOTMENT_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (row) => row.status },
  ];
  const sorts: SortOption<AllotmentRow>[] = [
    { id: "from", label: "Inicio de vigencia", type: "date", value: (row) => row.valid_from },
    { id: "utilization", label: "Uso 30 días", type: "number", value: (row) => row.utilization ?? -1 },
    { id: "penalties", label: "Penalidad", type: "number", value: (row) => row.penalties_pen },
  ];
  return <DataTable screen="cupos-contratos" rows={overview.contracts} columns={columns} getKey={(row) => row.code} entityLabel="contratos" searchText={(row) => `${row.code} ${row.name} ${row.provider.name} ${row.contract_ref ?? ""} ${row.service.name}`} searchPlaceholder="Buscar contrato o proveedor" metrics={metrics} filters={filters} sorts={sorts} csv={{
    fileName: "cupos-contratos",
    columns: [
      { header: "Contrato", value: (row) => row.code },
      { header: "Cupo", value: (row) => row.name },
      { header: "Referencia", value: (row) => row.contract_ref },
      { header: "Proveedor", value: (row) => row.provider.name },
      { header: "Servicio", value: (row) => row.service.name },
      { header: "Tipo", value: (row) => KIND_LABEL[row.kind] },
      { header: "Vigente desde", value: (row) => row.valid_from },
      { header: "Vigente hasta", value: (row) => row.valid_to },
      { header: "Bloqueo base", value: (row) => row.base_qty },
      { header: "Release (días)", value: (row) => row.release_days },
      { header: "Tarifa neta", value: (row) => row.net_rate },
      { header: "Moneda", value: (row) => row.currency },
      { header: "Penalidad %", value: (row) => row.penalty_pct },
      { header: "Uso 30 días %", value: (row) => row.utilization },
      { header: "Penalidad devengada", value: (row) => row.penalties },
      { header: "Estado", value: (row) => ALLOTMENT_STATUS[row.status].label },
    ],
  }} />;
}

export function ReleaseAlertsTable({ overview }: { overview: AllotmentsOverview }) {
  const pending = overview.alerts.filter((alert) => alert.type === "vencido").length;
  const columns: Column<AllotmentAlert>[] = [
    { id: "contract", header: "Contrato", mobile: "title", cell: (alert) => <ContractName contract={{ code: alert.contract, name: alert.name, provider: { id: "", code: "", name: alert.provider }, unit: "" }} /> },
    { id: "date", header: "Fecha de servicio", cell: (alert) => <span className="text-[13px]">{weekday(alert.date)} {formatDate(alert.date)}</span> },
    { id: "deadline", header: "Release", cell: (alert) => <span className="text-[13px]">{formatDate(alert.deadline)}<small className="block text-xs text-fg-3">{alert.to_deadline < 0 ? `Venció hace ${-alert.to_deadline} días` : alert.to_deadline === 0 ? "Vence hoy" : `Vence en ${alert.to_deadline} días`}</small></span> },
    { id: "units", header: "Unidades", align: "right", cell: (alert) => <b className="font-mono text-[13.5px]">{alert.units}</b> },
    { id: "penalty", header: "Penalidad si se retiene", align: "right", wideOnly: true, cell: (alert) => (alert.penalty ? <span className="text-[13px] font-semibold text-bad">{formatMoney(alert.penalty, alert.currency)}</span> : <span className="text-[12.5px] text-fg-3">Sin penalidad</span>) },
    { id: "type", header: "Situación", cell: (alert) => <span><Badge tone={ALERT_TYPE[alert.type].tone}>{ALERT_TYPE[alert.type].label}</Badge>{alert.reason && <small className="mt-1 block max-w-[220px] truncate text-xs text-fg-3">{alert.reason}</small>}</span> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (alert) => (
        <RowActions>
          <RowIcon tone="view" label="Gestionar fecha" href={`${detailHref(alert.contract)}?fecha=${alert.date}`} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<AllotmentAlert>[] = [
    { id: "vencido", label: "Release vencido", tone: "bad", icon: <TimerOff size={19} />, matches: (alert) => alert.type === "vencido" },
    { id: "proximo", label: "Vence pronto", tone: "warn", icon: <CalendarClock size={19} />, matches: (alert) => alert.type === "proximo" },
    { id: "retenido", label: "Retenidas", tone: "violet", icon: <Lock size={19} />, matches: (alert) => alert.type === "retenido" },
    { id: "sobreventa", label: "Sobreventa", tone: "bad", icon: <AlertTriangle size={19} />, matches: (alert) => alert.type === "sobreventa" },
  ];
  const job = overview.job;
  return (
    <div className="p-5">
      {job && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">
          <b className="font-semibold text-fg">Release automático</b>
          <span>{job.paused ? "En pausa" : job.schedule}</span>
          <span className="text-fg-3">·</span>
          <span>{job.last_run_at ? `Última vez ${formatDateTime(job.last_run_at, false)}: ${job.result ?? "sin resultado"}` : "Aún no se ejecutó"}</span>
        </p>
      )}
      <DataTable
        screen="cupos-release"
        rows={overview.alerts}
        columns={columns}
        getKey={(alert) => `${alert.type}-${alert.contract}-${alert.date}`}
        entityLabel="fechas"
        searchText={(alert) => `${alert.contract} ${alert.name} ${alert.provider} ${alert.reason ?? ""}`}
        searchPlaceholder="Buscar contrato o proveedor"
        metrics={metrics}
        toolbarEnd={overview.can.manage ? <RunReleaseJobAction pending={pending} /> : undefined}
        emptyTitle="No hay releases vencidos, próximos ni retenciones"
      />
    </div>
  );
}

function PickupChart({ cuts, curve, capacity, height = 150 }: { cuts: string[]; curve: number[]; capacity: number; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(capacity, ...curve, 1);
  const at = (value: number) => (value / max) * height;
  const targets = curve.map((_, index) => Math.round((capacity * 0.85 * (index + 1)) / curve.length));
  return (
    <div>
      <div className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-warn" style={{ bottom: at(capacity) }}>
          <span className="absolute -top-5 right-0 rounded bg-surface px-1 text-[11px] font-semibold text-warn">Cupo {capacity}</span>
        </span>
        <div className="grid h-full items-end gap-3.5" style={{ gridTemplateColumns: `repeat(${curve.length}, minmax(0, 1fr))` }}>
          {curve.map((value, index) => (
            <div key={cuts[index]} className="relative flex h-full items-end" onPointerEnter={() => setActive(index)}>
              <span aria-hidden className="absolute inset-x-[-6px] z-10 h-0.5 rounded-full bg-fg-3" style={{ bottom: at(targets[index]) }} />
              <div className={cn("w-full origin-bottom rounded-t-[10px] rounded-b-[4px] transition-[filter,opacity] duration-200 motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]", index === curve.length - 1 ? "bg-t2" : "bg-[color-mix(in_srgb,var(--t1)_85%,transparent)]", active !== null && active !== index && "opacity-45")} style={{ height: Math.max(4, at(value)), animationDelay: `${index * 70}ms` }} />
              {active === index && (
                <span className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11.5px] font-semibold text-bg shadow-lg motion-safe:animate-[drop-in_160ms_ease-out]" style={{ bottom: Math.max(at(value), at(targets[index])) + 8 }}>
                  {value} vendidas · objetivo {targets[index]} de {capacity}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 grid gap-3.5" style={{ gridTemplateColumns: `repeat(${curve.length}, minmax(0, 1fr))` }}>
        {curve.map((value, index) => (
          <span key={cuts[index]} className="text-center font-mono text-[11.5px] text-fg-3">
            {cuts[index].slice(8, 10)}/{cuts[index].slice(5, 7)} <b className="font-semibold text-fg">{value}</b>
          </span>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-t1" />Vendido acumulado</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-warn" />Cupo vigente</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-fg-3" />Ritmo objetivo 85 %</span>
      </p>
    </div>
  );
}

export function PickupReport({ pickup }: { pickup: AllotmentPickup }) {
  const [selected, setSelected] = useState(pickup.rows[0]?.code ?? "");
  const current = pickup.rows.find((row) => row.code === selected);
  const columns: Column<PickupRow>[] = [
    { id: "contract", header: "Contrato", mobile: "title", cell: (row) => <ContractName contract={row} /> },
    { id: "capacity", header: "Cupo vigente", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.window.capacity}</span> },
    { id: "used", header: "Vendido", align: "right", cell: (row) => <b className="font-mono text-[13px]">{row.window.used}</b> },
    { id: "pending", header: "En trámite", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.window.pending}</span> },
    { id: "utilization", header: "Uso", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.window.utilization} %</span> },
    { id: "p7", header: "Ventas 7 días", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.pickup_7}</span> },
    { id: "p30", header: "Ventas 30 días", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.pickup_30}</span> },
    { id: "recommendation", header: "Recomendación", cell: (row) => <Badge tone={RECOMMENDATION[row.recommendation].tone}>{RECOMMENDATION[row.recommendation].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="neutral" label="Ver curva" icon={row.kind === "hotel" ? <BedDouble size={15} /> : <TrainFront size={15} />} onClick={() => setSelected(row.code)} />
          <RowIcon tone="view" label="Ver contrato" href={detailHref(row.code)} />
        </RowActions>
      ),
    },
  ];
  return (
    <>
      {current && (
        <div className="border-b border-line-2 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px]">
              <b className="font-semibold">Ventas acumuladas por semana</b>
              <span className="text-fg-3"> · {current.provider.name}, para estadías de los próximos {pickup.horizon} días. Ritmo objetivo: 85 % del cupo.</span>
            </p>
            <div className="w-[260px]">
              <Select value={selected} onChange={setSelected} ariaLabel="Contrato" options={pickup.rows.map((row) => ({ value: row.code, label: row.provider.name, hint: row.code }))} className="h-10 w-full" />
            </div>
          </div>
          <PickupChart key={current.code} cuts={pickup.cuts} curve={current.curve} capacity={current.window.capacity} />
        </div>
      )}
      <div className="p-5">
        <DataTable screen="cupos-pickup" rows={pickup.rows} columns={columns} getKey={(row) => row.code} entityLabel="contratos" searchText={(row) => `${row.code} ${row.name} ${row.provider.name}`} searchPlaceholder="Buscar contrato" />
      </div>
    </>
  );
}
