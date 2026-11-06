"use client";

import { ArrowDownLeft, ArrowUpRight, CircleCheck, CircleX, FileQuestion, Link2, Sparkles, Wrench } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import type { BankLineRow, ReconciliationOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function lineSummary(row: BankLineRow) {
  return [
    { label: "Línea", value: `${row.code} · ${row.bank} · ${formatDate(row.date)}` },
    { label: "Descripción", value: row.description },
    { label: row.amount > 0 ? "Abono" : "Cargo", value: formatMoney(Math.abs(row.amount), row.currency), strong: true },
    ...(row.match ? [{ label: row.match.kind === "payment" ? "Pago sugerido" : "Obligación sugerida", value: `${row.match.code} · ${formatMoney(row.match.amount, row.match.currency)}` }] : []),
  ];
}

function ConfirmLineAction({ row }: { row: BankLineRow }) {
  return (
    <FinanceStep step="line_confirm" itemKey={row.code} label="Confirmar" title="Confirmar coincidencia" description={row.match?.kind === "payment" && row.match.status === "pendiente" ? "El pago pendiente pasa a confirmado; su aplicación a la cuota se hace en Pagos." : "La línea queda conciliada con su contraparte."} submitLabel="Confirmar" trigger={(open) => <RowIcon tone="edit" label="Confirmar coincidencia" icon={<CircleCheck size={15} />} onClick={open} />}>
      <SummaryBox rows={lineSummary(row)} />
      {row.difference !== null && Math.abs(row.difference) >= 0.5 && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Diferencia de {formatMoney(row.difference)} entre el banco y el documento en soles.</p>}
    </FinanceStep>
  );
}

function RejectLineAction({ row }: { row: BankLineRow }) {
  return (
    <FinanceStep step="line_reject" itemKey={row.code} label="Rechazar" title="Rechazar coincidencia" description="La línea pasa a excepción y deberá resolverse con sustento." submitLabel="Rechazar" trigger={(open) => <RowIcon tone="delete" label="Rechazar coincidencia" icon={<CircleX size={15} />} onClick={open} />}>
      <SummaryBox rows={lineSummary(row)} />
    </FinanceStep>
  );
}

function ResolveLineAction({ row }: { row: BankLineRow }) {
  const credit = row.amount > 0;
  return (
    <FinanceStep step="line_resolve" itemKey={row.code} label="Resolver" title="Resolver excepción" description="Se concilia sin afectar cobros ni obligaciones." submitLabel="Resolver" trigger={(open) => <RowIcon tone="edit" label="Resolver excepción" icon={<Wrench size={15} />} onClick={open} />}>
      <SummaryBox rows={lineSummary(row)} />
      <ChoiceGroup label="Resolución" name="resolution" options={credit ? [{ value: "otro_ingreso", label: "Otro ingreso" }] : [{ value: "gasto_bancario", label: "Gasto o comisión bancaria" }]} />
      <TextArea label="Sustento" name="note" rows={4} required minLength={5} maxLength={500} placeholder={credit ? "Ejemplo: devolución de garantía del local, confirmada con el banco." : "Ejemplo: comisión de mantenimiento de cuenta."} />
    </FinanceStep>
  );
}

export function BankLinesTable({ data }: { data: ReconciliationOverview }) {
  const { rows, can } = data;

  const columns: Column<BankLineRow>[] = [
    {
      id: "line",
      header: "Línea del extracto",
      mobile: "title",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-[9px]", row.amount > 0 ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad")}>
            {row.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[13px] font-semibold">{row.description}</span>
            <small className="block text-xs text-fg-3">
              {row.code} · {row.bank} · {formatDate(row.date)}
            </small>
          </span>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Importe",
      align: "right",
      cell: (row) => (
        <span className={cn("font-mono text-[13px] font-semibold", row.amount > 0 ? "text-ok" : "text-fg")}>
          {row.amount > 0 ? "+" : "−"}
          {formatMoney(Math.abs(row.amount), row.currency)}
        </span>
      ),
    },
    {
      id: "match",
      header: "Contraparte",
      cell: (row) =>
        row.match ? (
          <span className="text-[13px]" title={row.difference !== null ? `Diferencia ${formatMoney(row.difference)}` : undefined}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Link2 size={13} className="text-fg-3" />
              {row.match.code}
            </span>
            <span className="block max-w-[240px] truncate text-xs text-fg-3">{row.match.label}</span>
          </span>
        ) : (
          <span className="text-[13px] text-fg-3">{row.resolution ?? "Sin contraparte"}</span>
        ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5" title={row.note ?? undefined}>
          {row.status === "excepcion" ? <Badge tone="warn">Excepción</Badge> : <StatusBadge status={row.status} />}
          {row.status === "conciliado" && row.resolution && <span className="text-[11.5px] text-fg-3">{row.resolution}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          {can.operate && row.status === "sugerido" && !row.closure && (
            <>
              <ConfirmLineAction row={row} />
              <RejectLineAction row={row} />
            </>
          )}
          {can.operate && row.status === "excepcion" && !row.closure && <ResolveLineAction row={row} />}
          {(row.status === "conciliado" || row.closure) && <RowIcon tone="edit" label="Conciliada" icon={<CircleCheck size={15} />} disabledHint={row.closure ? `Cerrada en ${row.closure}` : `Conciliada${row.resolved_by ? ` por ${row.resolved_by}` : ""}`} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<BankLineRow>[] = [
    { id: "suggested", label: "Sugeridas", tone: "info", icon: <Sparkles size={19} />, matches: (row) => row.status === "sugerido" },
    { id: "exceptions", label: "Excepciones", tone: "warn", icon: <FileQuestion size={19} />, matches: (row) => row.status === "excepcion" || row.status === "pendiente" },
    { id: "reconciled", label: "Conciliadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "conciliado" },
  ];

  const filters: FilterConfig<BankLineRow>[] = [
    { id: "bank", label: "Banco", options: unique(rows.map((row) => row.bank)).map((value) => ({ value, label: value })), value: (row) => row.bank },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: value === "excepcion" ? "Excepción" : statusLabel(value) })), value: (row) => row.status },
  ];

  const sorts: SortOption<BankLineRow>[] = [
    { id: "date", label: "Fecha valor", type: "date", value: (row) => row.date },
    { id: "amount", label: "Importe", type: "number", value: (row) => Math.abs(row.amount) },
  ];

  return (
    <DataTable
      screen="finanzas-conciliacion"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="líneas"
      searchText={(row) => `${row.code} ${row.description} ${row.bank} ${row.match?.code ?? ""}`}
      searchPlaceholder="Buscar descripción, banco o documento"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
