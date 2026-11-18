"use client";

import { Download, FileDown, FileSpreadsheet, Receipt, ReceiptText, Scale, ShoppingBag, Wallet } from "lucide-react";
import { requestExport } from "@/app/(portal)/portal/corporativo/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { EXPORT_FORMATS, EXPORT_TYPES, KIND_TONE, num, type CorporateExport, type CorporateMovement, type CorporateMovements, type CostCenter } from "@/lib/corporate";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { CorporateStep } from "./CorporateForms";

const EXPORT_TONE: Record<CorporateExport["status"], Tone> = { en_cola: "info", procesando: "info", listo: "ok", fallido: "bad", vencido: "mute" };

export function ExportAction({ period, defaultType = "movimientos", types = EXPORT_TYPES }: { period: string; defaultType?: string; types?: { value: string; label: string }[] }) {
  return (
    <CorporateStep id={`exportar-${defaultType}`} label="Exportar" icon={<Download size={15} />} title="Exportar reporte" description="El archivo se prepara en segundo plano y queda disponible 7 días. Te avisamos cuando esté listo." submitLabel="Pedir exportación" action={requestExport}>
      <input type="hidden" name="period" value={period} />
      <SelectField label="Reporte" name="report_type" options={types} defaultValue={defaultType} />
      <SelectField label="Formato" name="format" options={EXPORT_FORMATS} defaultValue="xlsx" />
    </CorporateStep>
  );
}

export function ExportList({ exports }: { exports: CorporateExport[] }) {
  if (exports.length === 0) return <EmptyLine>Aún no pides exportaciones. Usa «Exportar» para llevarte el reporte en Excel, PDF o CSV.</EmptyLine>;
  return (
    <ul className="flex flex-col gap-2">
      {exports.map((row, index) => (
        <li key={row.code} style={rise(index)} className={cn("lift flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5", RISE)}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-surface-2 text-fg-2">{row.format === "pdf" ? <FileDown size={17} /> : <FileSpreadsheet size={17} />}</span>
            <span className="min-w-0">
              <b className="block truncate text-[13.5px] font-semibold">
                {row.report_label} · {row.filters.period ?? ""}
              </b>
              <span className="block text-[12px] text-fg-3">
                <span className="font-mono">{row.code}</span> · {row.format_label} · {formatDateTime(row.requested_at)}
                {row.row_count !== null ? ` · ${row.row_count} filas` : ""}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={EXPORT_TONE[row.status]}>{row.status_label}</Badge>
            {row.status === "listo" && (
              <a href={`/portal/corporativo/exportaciones/${row.code}`} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent/10 px-2.5 text-[12.5px] font-semibold text-accent transition hover:bg-accent/15">
                <Download size={14} />
                Descargar
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CorporateMovementsView({ data, centers, period, balance }: { data: CorporateMovements; centers: CostCenter[]; period: string; balance: string }) {
  const cur = data.currency;
  const columns: Column<CorporateMovement>[] = [
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{formatDate(row.date)}</span> },
    { id: "kind", header: "Tipo", cell: (row) => <Badge tone={KIND_TONE[row.kind]}>{row.kind_label}</Badge> },
    {
      id: "detail",
      header: "Detalle",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">{row.detail}</b>
          <small className="block font-mono text-xs text-fg-3">{row.document}</small>
        </span>
      ),
    },
    { id: "center", header: "C. costo", wideOnly: true, cell: (row) => <span className="font-mono text-[12.5px]">{row.cost_center ?? "—"}</span> },
    { id: "charge", header: "Cargo", align: "right", cell: (row) => <span className="font-mono text-[13px]">{num(row.charge) ? formatMoney(row.charge, cur) : ""}</span> },
    { id: "credit", header: "Abono", align: "right", cell: (row) => <span className="font-mono text-[13px] text-ok">{num(row.credit) ? formatMoney(row.credit, cur) : ""}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (row) => <b className="font-mono text-[13px]">{formatMoney(row.balance, cur)}</b> },
  ];
  const metrics: MetricFilter<CorporateMovement>[] = [
    { id: "saldo", label: "Saldo final", tone: num(data.totals.closing_balance) > 0 ? "sun" : "ok", icon: <Scale size={19} />, display: formatMoney(data.totals.closing_balance, cur), note: `Inicial ${formatMoney(data.opening_balance, cur)} · por pagar hoy ${formatMoney(balance, cur)}`, info: <p>Saldo al {formatDate(data.period.to)}: el saldo inicial al {formatDate(data.period.from)} más las compras y menos los pagos y notas de crédito del período. La nota muestra el saldo por pagar a la fecha, con todas las compras. Al presionarla ves todos los movimientos del período.</p>, matches: () => true },
    { id: "compras", label: "Compras", tone: "t1", icon: <ShoppingBag size={19} />, display: formatMoney(data.totals.charges, cur), note: "Cargos del período", info: <p>Compras de tu empresa registradas en el período como cargos a la cuenta. Al presionarla ves solo las compras.</p>, matches: (row) => row.kind === "compra" },
    { id: "pagos", label: "Pagos", tone: "ok", icon: <Wallet size={19} />, display: formatMoney(data.totals.payments, cur), note: "Abonos del período", info: <p>Pagos aplicados a la cuenta en el período. Al presionarla ves solo los pagos.</p>, matches: (row) => row.kind === "pago" },
    { id: "notas", label: "Notas de crédito", tone: "violet", icon: <ReceiptText size={19} />, display: formatMoney(data.totals.credits, cur), note: "Abonos del período", info: <p>Notas de crédito emitidas a tu empresa en el período, que reducen el saldo. Al presionarla ves solo las notas.</p>, matches: (row) => row.kind === "nota_credito" },
  ];
  const filters: FilterConfig<CorporateMovement>[] = [
    { id: "kind", label: "Tipo", options: [{ value: "compra", label: "Compra" }, { value: "pago", label: "Pago" }, { value: "nota_credito", label: "Nota de crédito" }], value: (row) => row.kind },
    { id: "center", label: "Centro de costo", options: centers.map((center) => ({ value: center.code, label: center.code })), value: (row) => row.cost_center ?? "" },
  ];
  const sorts: SortOption<CorporateMovement>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.date },
    { id: "charge", label: "Cargo", type: "number", value: (row) => num(row.charge) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <DataTable
        screen="portal-corporativo-movimientos"
        rows={data.rows}
        columns={columns}
        getKey={(row) => row.id}
        entityLabel="movimientos"
        searchText={(row) => `${row.document} ${row.detail} ${row.cost_center ?? ""}`}
        searchPlaceholder="Buscar documento o detalle"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        toolbarEnd={<ExportAction period={period} />}
        emptyTitle="Sin movimientos en el período"
      />
      <SectionCard icon={Receipt} title="Exportaciones recientes" aside={data.exports.length}>
        <ExportList exports={data.exports} />
      </SectionCard>
    </div>
  );
}
