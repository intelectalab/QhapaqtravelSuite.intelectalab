"use client";

import { CircleCheck, FileMinus2, RefreshCw, TriangleAlert } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { FinanceOption, InvoiceRow, InvoicesOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel, type Tone } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const TYPE_TONE: Record<string, Tone> = { "01": "t1", "03": "t4", "07": "violet", "08": "sun" };

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function invoiceSummary(row: InvoiceRow) {
  return [
    { label: "Comprobante", value: `${row.type} ${row.number}` },
    { label: "Cliente", value: `${row.customer.name} · ${row.customer.doc_type} ${row.customer.doc_number}` },
    { label: row.operation === "gravada" ? "Base + IGV" : "Exportación sin IGV", value: row.operation === "gravada" ? `${formatMoney(row.taxable, row.currency)} + ${formatMoney(row.igv, row.currency)}` : formatMoney(row.taxable, row.currency) },
    { label: "Total", value: formatMoney(row.total, row.currency), strong: true },
  ];
}

function CreditNoteAction({ row, reasons }: { row: InvoiceRow; reasons: FinanceOption[] }) {
  return (
    <FinanceStep
      step="invoice_credit"
      itemKey={row.number}
      label="Nota de crédito"
      title="Emitir nota de crédito"
      description="Si cubre todo el saldo del comprobante, este queda anulado. La nota se envía al OSE y espera su respuesta."
      submitLabel="Emitir nota de crédito"
      trigger={(open) => <RowIcon tone="delete" label="Anular con nota de crédito" icon={<FileMinus2 size={15} />} onClick={open} />}
    >
      <SummaryBox rows={[...invoiceSummary(row), { label: "Saldo acreditable", value: formatMoney(row.creditable, row.currency) }]} />
      <SelectField label="Motivo (catálogo 09)" name="reason_code" options={reasons} defaultValue={reasons[0]?.value} />
      <TextField label={`Importe (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={row.creditable} defaultValue={row.creditable.toFixed(2)} hint="Por defecto, todo el saldo: anula el comprobante." />
      <TextArea label="Sustento" name="detail" rows={3} maxLength={255} placeholder="Ejemplo: cancelación de la reserva por fuerza mayor." />
    </FinanceStep>
  );
}

function FiscalStatusAction({ row }: { row: InvoiceRow }) {
  return (
    <FinanceStep step="invoice_status" itemKey={row.number} label="Consultar OSE" title="Consultar respuesta del OSE" description="Obtiene la respuesta del operador para este comprobante." submitLabel="Consultar" trigger={(open) => <RowIcon tone="edit" label="Consultar respuesta del OSE" icon={<RefreshCw size={15} />} onClick={open} />}>
      <SummaryBox rows={invoiceSummary(row)} />
      <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">La integración con el OSE aún es simulada: la respuesta llega como aceptada.</p>
    </FinanceStep>
  );
}

export function InvoicesTable({ data }: { data: InvoicesOverview }) {
  const { rows, can, reasons } = data;

  const columns: Column<InvoiceRow>[] = [
    {
      id: "number",
      header: "Comprobante",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-mono font-semibold">{row.number}</span>
          <span className="ml-2 align-middle">
            <Badge tone={TYPE_TONE[row.doc_type] ?? "mute"} dot={false}>
              {row.type}
            </Badge>
          </span>
          <small className="block max-w-[280px] truncate text-xs text-fg-3" title={row.description}>
            {row.ref_number ? `Modifica ${row.ref_number} · ` : ""}
            {row.description}
          </small>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Cliente",
      cell: (row) => (
        <span className="text-[13px]">
          {row.customer.name}
          <span className="block text-xs text-fg-3">
            {row.customer.doc_type} {row.customer.doc_number}
          </span>
        </span>
      ),
    },
    { id: "date", header: "Emisión", cell: (row) => <span className="text-[13px]">{formatDate(row.issue_date)}</span> },
    { id: "total", header: "Total", align: "right", cell: (row) => <span className={`font-mono text-[13px] font-semibold ${row.doc_type === "07" ? "text-bad" : ""}`} title={row.in_words}>{row.doc_type === "07" ? "−" : ""}{formatMoney(row.total, row.currency)}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5" title={row.ose_message ?? undefined}>
          <StatusBadge status={row.status} />
          {row.status === "observado" && row.ose_message && <span className="max-w-[200px] truncate text-[11.5px] text-fg-3">{row.ose_message}</span>}
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
          <RowIcon tone="view" label="Ver reserva" href={`/reservas/${row.reservation.code}`} />
          {can.issue && row.status === "emitido" && <FiscalStatusAction row={row} />}
          {can.issue && (row.creditable > 0 ? <CreditNoteAction row={row} reasons={reasons} /> : <RowIcon tone="delete" label="Nota de crédito" icon={<FileMinus2 size={15} />} disabledHint={row.doc_type === "07" ? "Una nota de crédito no se acredita" : row.status === "anulado" ? "El comprobante ya está anulado" : "Solo sobre comprobantes aceptados por el OSE"} />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<InvoiceRow>[] = [
    { id: "accepted", label: "Aceptados", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "aceptado" },
    { id: "observed", label: "Observados", tone: "warn", icon: <TriangleAlert size={19} />, matches: (row) => row.status === "observado" || row.status === "rechazado" },
    { id: "credit", label: "Notas de crédito", tone: "violet", icon: <FileMinus2 size={19} />, matches: (row) => row.doc_type === "07" },
  ];

  const filters: FilterConfig<InvoiceRow>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: value })), value: (row) => row.type },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "currency", label: "Moneda", options: unique(rows.map((row) => row.currency)).map((value) => ({ value, label: value })), value: (row) => row.currency },
  ];

  const sorts: SortOption<InvoiceRow>[] = [
    { id: "date", label: "Emisión", type: "date", value: (row) => row.issue_date },
    { id: "total", label: "Total en soles", type: "number", value: (row) => row.pen },
  ];

  return (
    <DataTable
      screen="finanzas-facturacion"
      rows={rows}
      columns={columns}
      getKey={(row) => row.number}
      entityLabel="comprobantes"
      searchText={(row) => `${row.number} ${row.customer.name} ${row.customer.doc_number} ${row.reservation.code}`}
      searchPlaceholder="Buscar número, cliente o documento"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
