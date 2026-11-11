"use client";

import type { ReactNode } from "react";
import { CalendarCheck, CalendarOff, CircleCheck, Hourglass, TimerOff, Undo2 } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { HOLD_STATUS, RANGE_STATUS, type AvailabilityOverview, type HoldRow, type RangeRow } from "@/lib/catalog-availability";
import { daysBetween } from "@/lib/catalog-rates";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { HoldActions, RangeDeleteAction, RangeEditAction } from "./AvailabilityForms";

const WINDOW = 120;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

function WindowBar({ range, today }: { range: RangeRow; today: string }) {
  const start = Math.max(0, daysBetween(today, range.date_from));
  const end = Math.min(WINDOW, daysBetween(today, range.date_to) + 1);
  const visible = end > start && start < WINDOW;
  return (
    <div className="w-[150px]" style={toneStyle(RANGE_STATUS[range.status].tone)} title={`Próximos ${WINDOW} días`}>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
        {visible && (
          <span
            className={cn("absolute inset-y-0 origin-left rounded-full motion-safe:animate-[fill-x_640ms_cubic-bezier(0.22,1,0.36,1)_backwards]", range.status === "disponible" ? "bg-[var(--tint)]" : "bg-[repeating-linear-gradient(135deg,var(--tint)_0_4px,transparent_4px_8px)]")}
            style={{ left: `${(start / WINDOW) * 100}%`, width: `${((end - start) / WINDOW) * 100}%` }}
          />
        )}
      </div>
      <p className="mt-1 text-[11.5px] text-fg-3">{visible ? `${range.days} días` : range.phase === "pasado" ? "Ya terminó" : "Más adelante"}</p>
    </div>
  );
}

export function RangesTable({ overview, toolbarEnd }: { overview: AvailabilityOverview; toolbarEnd?: ReactNode }) {
  const columns: Column<RangeRow>[] = [
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (range) => (
        <span className="min-w-0">
          <b className="block truncate font-semibold">{range.product.name}</b>
          <small className="block text-xs text-fg-3">{range.code}{range.note ? ` · ${range.note}` : ""}</small>
        </span>
      ),
    },
    { id: "dates", header: "Fechas", cell: (range) => <span className="text-[13px]">{formatDate(range.date_from)} – {formatDate(range.date_to)}</span> },
    { id: "window", header: "Próximos 4 meses", wideOnly: true, cell: (range) => <WindowBar range={range} today={overview.today} /> },
    { id: "capacity", header: "Cupos por día", align: "right", cell: (range) => (range.status === "disponible" ? <span className="font-mono text-[13px] font-semibold">{range.capacity_per_day}</span> : <span className="text-fg-3">—</span>) },
    { id: "status", header: "Estado", cell: (range) => <Badge tone={RANGE_STATUS[range.status].tone}>{RANGE_STATUS[range.status].label}</Badge> },
    ...(overview.can.manage_ranges
      ? [
          {
            id: "actions",
            header: "",
            mobile: "hidden" as const,
            align: "right" as const,
            cell: (range: RangeRow) => (
              <RowActions>
                <RangeEditAction overview={overview} range={range} />
                <RangeDeleteAction range={range} />
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const metrics: MetricFilter<RangeRow>[] = [
    { id: "now", label: "Vigentes hoy", tone: "ok", icon: <CalendarCheck size={19} />, matches: (range) => range.phase === "en_curso" && range.status === "disponible" },
    { id: "closed", label: "Cierres", tone: "bad", icon: <CalendarOff size={19} />, matches: (range) => range.status !== "disponible" && range.phase !== "pasado" },
  ];
  const filters: FilterConfig<RangeRow>[] = [
    { id: "product", label: "Producto", options: unique(overview.ranges.map((range) => range.product.name)), value: (range) => range.product.name },
    { id: "status", label: "Estado", options: Object.entries(RANGE_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (range) => range.status },
  ];
  return <DataTable screen="cupos-rangos" rows={overview.ranges} columns={columns} getKey={(range) => range.code} entityLabel="rangos" searchText={(range) => `${range.code} ${range.product.name} ${range.note ?? ""}`} searchPlaceholder="Buscar producto o nota" metrics={metrics} filters={filters} toolbarEnd={toolbarEnd} />;
}

export function HoldsTable({ overview }: { overview: AvailabilityOverview }) {
  const columns: Column<HoldRow>[] = [
    {
      id: "reference",
      header: "Referencia",
      mobile: "title",
      cell: (hold) => (
        <span className="min-w-0">
          <b className="block truncate font-semibold">{hold.reference}</b>
          <small className="block text-xs text-fg-3">{hold.ref}{hold.user ? ` · ${hold.user}` : ""}</small>
        </span>
      ),
    },
    {
      id: "departure",
      header: "Salida",
      cell: (hold) => (
        <span className="text-[13px]">
          {hold.product.name ?? "—"}
          {hold.departure && <small className="block text-xs text-fg-3">{hold.departure.ref} · {formatDate(hold.departure.date)} {hold.departure.time}</small>}
        </span>
      ),
    },
    { id: "quantity", header: "Cupos", align: "right", cell: (hold) => <span className="font-mono text-[13.5px] font-semibold">{hold.quantity}</span> },
    {
      id: "expires",
      header: "Vence",
      wideOnly: true,
      cell: (hold) => (hold.status === "hold" ? <span className={cn("text-[13px]", hold.expired ? "font-semibold text-bad" : "text-fg-2")}>{formatDateTime(hold.expires_at, false)}</span> : <span className="text-[12.5px] text-fg-3">{hold.released_reason ?? "—"}</span>),
    },
    { id: "status", header: "Estado", cell: (hold) => <Badge tone={hold.expired ? "bad" : HOLD_STATUS[hold.status].tone}>{hold.expired ? "Vencido" : HOLD_STATUS[hold.status].label}</Badge> },
    ...(overview.can.manage_holds
      ? [
          {
            id: "actions",
            header: "",
            mobile: "hidden" as const,
            align: "right" as const,
            cell: (hold: HoldRow) => (
              <RowActions>
                <HoldActions hold={hold} />
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const metrics: MetricFilter<HoldRow>[] = [
    { id: "hold", label: "En hold", tone: "sun", icon: <Hourglass size={19} />, matches: (hold) => hold.status === "hold" && !hold.expired },
    { id: "expired", label: "Vencidos", tone: "bad", icon: <TimerOff size={19} />, matches: (hold) => hold.expired || hold.status === "expirada" },
    { id: "confirmed", label: "Confirmados", tone: "ok", icon: <CircleCheck size={19} />, matches: (hold) => hold.status === "confirmada" || hold.status === "consumida" },
    { id: "released", label: "Liberados", tone: "mute", icon: <Undo2 size={19} />, matches: (hold) => hold.status === "liberada" },
  ];
  const filters: FilterConfig<HoldRow>[] = [{ id: "status", label: "Estado", options: Object.entries(HOLD_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (hold) => hold.status }];
  return <DataTable screen="cupos-holds" rows={overview.holds} columns={columns} getKey={(hold) => hold.ref} entityLabel="bloqueos" searchText={(hold) => `${hold.ref} ${hold.reference} ${hold.product.name ?? ""} ${hold.departure?.ref ?? ""}`} searchPlaceholder="Buscar referencia o salida" metrics={metrics} filters={filters} csv={{
    fileName: "holds",
    columns: [
      { header: "Hold", value: (hold) => hold.ref },
      { header: "Referencia", value: (hold) => hold.reference },
      { header: "Producto", value: (hold) => hold.product.name },
      { header: "Salida", value: (hold) => hold.departure?.ref },
      { header: "Fecha", value: (hold) => hold.departure?.date },
      { header: "Cupos", value: (hold) => hold.quantity },
      { header: "Vence", value: (hold) => (hold.status === "hold" ? hold.expires_at : null) },
      { header: "Usuario", value: (hold) => hold.user },
      { header: "Estado", value: (hold) => (hold.expired ? "Vencido" : HOLD_STATUS[hold.status].label) },
      { header: "Motivo", value: (hold) => hold.released_reason },
    ],
  }} />;
}
