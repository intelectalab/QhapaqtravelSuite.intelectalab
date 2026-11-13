"use client";

import { BarChart3, Briefcase, CalendarClock, Download, FileText, Gauge, Layers, Lock, Percent, Plane, ShieldCheck, Star, Truck, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { exportReport, scheduleReport } from "@/app/(backoffice)/reportes/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { Select } from "@/components/ui/Select";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import { cn } from "@/lib/cn";
import type { ReportPayload } from "@/lib/reports";
import { statusTone, type Tone } from "@/lib/tone";
import { formatReportValue, ReportChartView } from "./ReportCharts";
import { REPORT_FREQUENCIES } from "./frequencies";

type Row = Record<string, string | number | null>;

const KPI_ICONS: Record<string, LucideIcon> = { money: Wallet, percent: Percent, hours: CalendarClock, days: CalendarClock, rating: Star, number: Gauge };

const TONES: Tone[] = ["t1", "t3", "t4", "violet", "t2"];

const REPORT_ICON: Record<string, LucideIcon> = { comercial: Briefcase, cotizaciones: FileText, reservas: Plane, operaciones: Layers, finanzas: Wallet, proveedores: Truck, clientes: UsersRound };

const SOURCES: Record<string, string> = {
  "comercial.leads": "Leads creados en el periodo, sin contar los duplicados descartados.",
  "comercial.conversion": "Leads convertidos en cliente y oportunidad entre los leads válidos del periodo.",
  "comercial.pipeline": "Monto de las oportunidades abiertas (calificación, descubrimiento, cotización y negociación) creadas en el periodo.",
  "comercial.win_rate": "Oportunidades ganadas entre las ya decididas (ganadas más perdidas).",
  "comercial.ticket": "Ventas confirmadas en soles divididas entre el número de reservas.",
  "cotizaciones.issued": "Cotizaciones creadas en el periodo; el detalle suma sus versiones.",
  "cotizaciones.approval": "Aprobadas o convertidas entre las decididas (aprobadas, convertidas, rechazadas y vencidas).",
  "cotizaciones.first_view": "Promedio de horas entre la creación y la primera vez que el cliente abrió la propuesta.",
  "cotizaciones.cycle": "Promedio de días entre la creación y la aprobación.",
  "cotizaciones.value": "Suma del total de la versión vigente de cada cotización, en soles.",
  "reservas.reservations": "Reservas creadas en el periodo, en cualquier estado.",
  "reservas.pax": "Pasajeros registrados en las reservas vendidas.",
  "reservas.sales": "Total de las reservas vendidas en soles al tipo de cambio de cada reserva; las canceladas no suman.",
  "reservas.ticket": "Ventas divididas entre las reservas vendidas.",
  "reservas.cancelled": "Reservas canceladas del periodo y su peso sobre el total.",
  "operaciones.services": "Servicios con fecha en el periodo, sin los cancelados.",
  "operaciones.pending": "Solicitudes a proveedores que siguen sin respuesta.",
  "operaciones.incidents": "Incidencias reportadas en el periodo.",
  "operaciones.punctuality": "Asignaciones con el primer check-in dentro de la tolerancia configurada en Operaciones.",
  "operaciones.tasks": "Tareas sin completar de las órdenes del periodo.",
  "finanzas.sales": "Total de las reservas vendidas en soles; las canceladas no suman.",
  "finanzas.cost": "Costo de los servicios no cancelados de esas reservas.",
  "finanzas.profit": "Ventas menos costo.",
  "finanzas.margin": "Utilidad sobre ventas.",
  "finanzas.billed": "Cuotas por cobrar emitidas para las reservas del periodo.",
  "finanzas.collected": "Pagos aplicados a esas cuotas.",
  "finanzas.receivable": "Saldo pendiente de todas las cuotas abiertas; lo vencido es lo que pasó su fecha.",
  "proveedores.providers": "Proveedores con al menos un servicio en el periodo.",
  "proveedores.services": "Servicios de proveedores con fecha en el periodo.",
  "proveedores.cost": "Costo de esos servicios en soles.",
  "proveedores.rating": "Promedio de la calificación de los proveedores utilizados.",
  "proveedores.expiring": "Proveedores activos con contrato que vence en los próximos 60 días.",
  "clientes.clients": "Clientes de la cartera, empresas y personas.",
  "clientes.buying": "Clientes con al menos una reserva vendida en el periodo.",
  "clientes.average": "Ventas divididas entre los clientes que compraron.",
  "clientes.nps": "Promotores (9 y 10) menos detractores (0 a 6) sobre las respuestas.",
  "clientes.foreign": "Clientes con país distinto de Perú.",
};

function Filters({ report }: { report: ReportPayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (period: string, sede: string) => {
    const query = new URLSearchParams();
    if (period !== "6m") query.set("period", period);
    if (sede) query.set("sede", sede);
    router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Periodo" className="flex gap-1 rounded-control bg-surface-2 p-1">
        {report.periods.map((period) => (
          <button key={period.key} type="button" role="radio" aria-checked={report.filters.period === period.key} onClick={() => go(period.key, report.filters.sede?.id ?? "")} className={cn("rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition", report.filters.period === period.key ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}>
            {period.label}
          </button>
        ))}
      </div>
      {report.sedes.length > 1 && (
        <div className="w-56">
          <Select value={report.filters.sede?.id ?? ""} onChange={(sede) => go(report.filters.period, sede)} options={[{ value: "", label: "Todas las sedes" }, ...report.sedes.map((sede) => ({ value: sede.id, label: sede.name }))]} ariaLabel="Sede" variant="chip" />
        </div>
      )}
    </div>
  );
}

function Hidden({ report }: { report: ReportPayload }) {
  return (
    <>
      <input type="hidden" name="report_key" value={report.key} />
      <input type="hidden" name="period" value={report.filters.period} />
      {report.filters.sede && <input type="hidden" name="sede" value={report.filters.sede.id} />}
    </>
  );
}

function Actions({ report }: { report: ReportPayload }) {
  const router = useRouter();
  if (!report.can_export) {
    return (
      <div className="flex flex-wrap gap-2" title="Requiere permiso de exportación">
        <Button size="sm" icon={<Lock size={14} />} disabled>
          Programar envío
        </Button>
        <Button size="sm" icon={<Lock size={14} />} disabled>
          Exportar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <PanelAction<AdminActionState> label="Programar envío" icon={<CalendarClock size={15} />} formId={`report-schedule-${report.key}`} title={`Programar el reporte ${report.title}`} description="Se genera y se envía por correo con la frecuencia que elijas. Lo puedes pausar o eliminar en Integraciones y jobs." submitLabel="Programar" action={scheduleReport} initial={ADMIN_INITIAL} onDone={() => router.push("/reportes/exportaciones")}>
        {() => (
          <>
            <Hidden report={report} />
            <SelectField label="Frecuencia" name="frequency" options={REPORT_FREQUENCIES} defaultValue="weekly" />
            <TextField label="Hora" name="time" required defaultValue="07:00" maxLength={5} placeholder="HH:MM" hint="Hora de Lima." />
            <ChoiceGroup label="Formato" name="format" options={[{ value: "PDF", label: "PDF" }, { value: "XLSX", label: "Excel" }, { value: "CSV", label: "CSV" }]} defaultValue="PDF" />
            <TextArea label="Destinatarios" name="recipients" rows={3} required placeholder="gerencia@agencia.pe, finanzas@agencia.pe" hint="Hasta 10 correos, separados por coma o en líneas." />
          </>
        )}
      </PanelAction>
      <PanelAction<AdminActionState> label="Exportar" icon={<Download size={15} />} variant="primary" formId={`report-export-${report.key}`} title={`Exportar ${report.title}`} description={`${report.filters.label}${report.filters.sede ? ` · ${report.filters.sede.name}` : " · todas las sedes"}. El archivo queda en Exportaciones por 7 días.`} submitLabel="Generar archivo" action={exportReport} initial={ADMIN_INITIAL} onDone={() => router.push("/reportes/exportaciones")}>
        {() => (
          <>
            <Hidden report={report} />
            <ChoiceGroup label="Formato" name="format" options={[{ value: "XLSX", label: "Excel" }, { value: "PDF", label: "PDF" }, { value: "CSV", label: "CSV" }]} defaultValue="XLSX" />
            <ChoiceGroup label="Alcance" name="scope" options={[{ value: "filtered", label: "Con los filtros" }, { value: "detailed", label: "Detallado" }]} defaultValue="filtered" hint="Excel incluye una hoja por gráfico; PDF, los KPIs, los gráficos y la tabla." />
          </>
        )}
      </PanelAction>
    </div>
  );
}

function cellOf(column: ReportPayload["table"]["columns"][number], row: Row, link: string | null, first: boolean) {
  const value = row[column.key];
  if (column.format === "status") return value ? <Badge tone={statusTone(String(row.status_key ?? value))}>{String(value)}</Badge> : "—";
  const text = formatReportValue(value, column.format);
  const warn = column.warn_below !== undefined && typeof value === "number" && value < column.warn_below;
  if (first && link) {
    const href = link.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(row[key] ?? "")));
    return (
      <Link href={href} className="font-semibold hover:text-accent">
        {text}
      </Link>
    );
  }
  return <span className={cn(warn && "font-semibold text-warn", first && "font-semibold")}>{text}</span>;
}

function ReportTable({ report }: { report: ReportPayload }) {
  const numeric = ["money", "number", "percent", "hours", "days", "rating"];
  const columns: Column<Row>[] = report.table.columns.map((column, index) => ({
    id: column.key,
    header: column.label,
    align: numeric.includes(column.format) ? "right" : undefined,
    mobile: index === 0 ? "title" : undefined,
    cell: (row) => cellOf(column, row, report.table.link, index === 0),
  }));
  const sorts: SortOption<Row>[] = report.table.columns.filter((column) => numeric.includes(column.format) || column.format === "date").map((column) => ({ id: column.key, label: column.label, type: column.format === "date" ? "date" : "number", value: (row) => row[column.key] }));
  const filters: FilterConfig<Row>[] = report.table.columns
    .filter((column) => column.filter)
    .map((column) => ({
      id: column.key,
      label: column.label,
      options: [...new Set(report.table.rows.map((row) => String(row[column.key] ?? "")).filter((value) => value !== ""))].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value })),
      value: (row: Row) => String(row[column.key] ?? ""),
    }))
    .filter((filter) => filter.options.length > 1);
  return (
    <div>
      <DataTable
        screen={`reporte-${report.key}`}
        rows={report.table.rows}
        columns={columns}
        getKey={(row) => String(row.code ?? row.id ?? row.name ?? row.seller ?? JSON.stringify(row))}
        entityLabel="filas"
        searchText={(row) => Object.values(row).join(" ")}
        searchPlaceholder="Buscar en el detalle"
        sorts={sorts}
        filters={filters}
        footer={
          report.table.totals
            ? Object.fromEntries(report.table.columns.map((column, index) => [column.key, index === 0 ? "Total" : report.table.totals?.[column.key] !== undefined && report.table.totals?.[column.key] !== null ? <span className="font-mono">{formatReportValue(report.table.totals[column.key] ?? null, column.format)}</span> : null]))
            : undefined
        }
      />
    </div>
  );
}

export function ReportView({ report }: { report: ReportPayload }) {
  const Icon = REPORT_ICON[report.key] ?? BarChart3;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filters report={report} />
        <Actions report={report} />
      </div>
      {(report.scope === "own" || report.variant === "contable") && (
        <p className="flex items-center gap-2 rounded-[12px] bg-accent/5 px-3.5 py-2.5 text-[12.5px] text-fg-2">
          <ShieldCheck size={15} className="flex-none text-accent" />
          {report.scope === "own" ? "Ves solo tu cartera: tus leads, oportunidades, cotizaciones, reservas y clientes." : "Vista contable: sin costos, utilidad ni margen, que requieren el permiso de rentabilidad."}
        </p>
      )}
      <KpiGrid columns={report.kpis.length > 4 ? 3 : 4}>
        {report.kpis.map((kpi, index) => (
          <TintTile
            key={kpi.key}
            icon={KPI_ICONS[kpi.format] ?? Gauge}
            tone={TONES[index % TONES.length]}
            label={kpi.label}
            value={formatReportValue(kpi.value, kpi.format)}
            note={kpi.hint ?? undefined}
            info={
              <p>
                {SOURCES[`${report.key}.${kpi.key}`] ?? kpi.label}
                <span className="mt-1 block text-fg-3">
                  {report.filters.label}
                  {report.filters.sede ? ` · ${report.filters.sede.name}` : " · todas las sedes"}
                </span>
              </p>
            }
          />
        ))}
      </KpiGrid>
      <div className="grid gap-5 xl:grid-cols-2">
        {report.charts.map((chart, index) => (
          <Card key={chart.key} className={cn(chart.type === "lines" || chart.type === "pair" ? "xl:col-span-2" : undefined)}>
            <TintCardTitle icon={index === 0 ? Icon : BarChart3} title={chart.title} tone={TONES[index % TONES.length]} />
            <ReportChartView chart={chart} tone={TONES[index % TONES.length]} />
          </Card>
        ))}
      </div>
      <Card>
        <TintCardTitle icon={Icon} title="Detalle" aside={`${report.table.rows.length} filas`} />
        <ReportTable report={report} />
      </Card>
    </div>
  );
}
