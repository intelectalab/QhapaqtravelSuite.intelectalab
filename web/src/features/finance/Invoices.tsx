"use client";

import { CircleCheck, FilePlus2, FileMinus2, RefreshCw, Send, SendHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkInvoice, loadInvoiceDraft } from "@/app/(backoffice)/finanzas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { FinanceOption, InvoiceCheck, InvoiceDraft, InvoicePending, InvoiceRow, InvoicesOverview } from "@/lib/finance";
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

export function InvoiceRowActions({ row, reasons }: { row: InvoiceRow; reasons: FinanceOption[] }) {
  return (
    <>
      {(row.status === "emitido" || row.status === "pendiente_envio") && <FiscalStatusAction row={row} />}
      {row.status === "observado" && <ResendAction row={row} />}
      {row.status === "aceptado" && <DeliverAction row={row} />}
      {row.creditable > 0 ? <CreditNoteAction row={row} reasons={reasons} /> : <RowIcon tone="delete" label="Nota de crédito" icon={<FileMinus2 size={15} />} disabledHint={row.doc_type === "07" ? "Una nota de crédito no se acredita" : row.status === "anulado" ? "El comprobante ya está anulado" : "Solo sobre comprobantes aceptados por el OSE"} />}
    </>
  );
}

function CreditNoteAction({ row, reasons }: { row: InvoiceRow; reasons: FinanceOption[] }) {
  return (
    <FinanceStep
      step="invoice_credit"
      itemKey={row.number}
      label="Nota de crédito"
      title="Emitir nota de crédito"
      description="La nota se envía al OSE. Si cubre todo el saldo del comprobante, este queda anulado cuando el OSE la acepta."
      submitLabel="Emitir nota de crédito"
      trigger={(open) => <RowIcon tone="delete" label="Anular con nota de crédito" icon={<FileMinus2 size={15} />} onClick={open} />}
    >
      <SummaryBox rows={[...invoiceSummary(row), { label: "Saldo acreditable", value: formatMoney(row.creditable, row.currency) }]} />
      <input type="hidden" name="doc_type" value="07" />
      <input type="hidden" name="ref_invoice_id" value={row.number} />
      <SelectField label="Motivo (catálogo 09)" name="credit_note_reason_code" options={reasons} defaultValue={reasons[0]?.value} />
      <TextField label={`Importe (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={row.creditable} defaultValue={row.creditable.toFixed(2)} hint="Por defecto, todo el saldo: al aceptarla el OSE, anula el comprobante." />
      <TextArea label="Sustento" name="credit_note_reason" rows={3} maxLength={255} placeholder="Ejemplo: cancelación de la reserva por fuerza mayor." />
    </FinanceStep>
  );
}

function FiscalStatusAction({ row }: { row: InvoiceRow }) {
  return (
    <FinanceStep step="invoice_status" itemKey={row.number} label="Consultar OSE" title="Consultar respuesta del OSE" description={row.status === "pendiente_envio" ? "El comprobante aún no sale: se vuelve a enviar al operador." : "Obtiene la respuesta del operador para este comprobante."} submitLabel="Consultar" trigger={(open) => <RowIcon tone="edit" label="Consultar respuesta del OSE" icon={<RefreshCw size={15} />} onClick={open} />}>
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
          <Link href={`/finanzas/facturacion/${row.number}`} className="font-mono font-semibold hover:underline">
            {row.number}
          </Link>
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
          <RowIcon tone="view" label="Ver comprobante" href={`/finanzas/facturacion/${row.number}`} testId={`invoice-view:${row.number}`} />
          {can.issue && <InvoiceRowActions row={row} reasons={reasons} />}
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

function DeliverAction({ row }: { row: InvoiceRow }) {
  return (
    <FinanceStep step="invoice_deliver" itemKey={row.number} label={row.delivered ? "Reenviar al cliente" : "Entregar al cliente"} title={row.delivered ? "Reenviar al cliente" : "Entregar al cliente"} description="Se envía por correo y queda disponible en el portal del cliente." submitLabel="Enviar" trigger={(open) => <RowIcon tone="neutral" label={row.delivered ? "Reenviar al cliente" : "Entregar al cliente"} icon={<Send size={15} />} onClick={open} />}>
      <SummaryBox rows={invoiceSummary(row)} />
      <TextField label="Correo (opcional)" name="email" type="email" maxLength={150} hint="Si lo dejas vacío, se usa el correo del cliente." />
    </FinanceStep>
  );
}

function ResendAction({ row }: { row: InvoiceRow }) {
  return (
    <FinanceStep step="invoice_resend" itemKey={row.number} label="Corregir y reenviar" title="Corregir y reenviar" description={row.ose_message ? `Observación del OSE: ${row.ose_message}` : "Corrige el tipo de cambio o la descripción y vuelve a enviarlo."} submitLabel="Reenviar al OSE" trigger={(open) => <RowIcon tone="edit" label="Corregir y reenviar" icon={<SendHorizontal size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={invoiceSummary(row)} />
      {row.currency !== "PEN" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.000001" min="0.000001" defaultValue={row.fx_rate ?? undefined} />}
      <TextArea label="Descripción" name="description" rows={3} maxLength={500} defaultValue={row.description} />
      <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Confirma con tu OSE si acepta el reenvío con el mismo número; si no, emite una nota de crédito y un comprobante nuevo.</p>
    </FinanceStep>
  );
}

const DOC_OPTIONS = [
  { value: "RUC", label: "RUC" },
  { value: "DNI", label: "DNI" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "CE", label: "Carné de extranjería" },
  { value: "SIN_DOC", label: "Sin documento" },
];

function IssueInvoiceFields({ code }: { code: string }) {
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<InvoiceCheck | null>(null);

  useEffect(() => {
    loadInvoiceDraft(code).then((result) => {
      setError(result.message);
      if (!result.draft) return;
      setDraft(result.draft);
      setForm({ receivable_id: code, doc_type: result.draft.doc_type, customer_doc_type: result.draft.customer_doc_type, customer_doc_number: result.draft.customer_doc_number, customer_name: result.draft.customer_name, domiciled: result.draft.domiciled ? "1" : "0", amount: result.draft.amount, description: result.draft.description, fx_rate: result.draft.fx_rate ?? "" });
    });
  }, [code]);

  useEffect(() => {
    if (!form.receivable_id) return;
    const timer = setTimeout(() => {
      checkInvoice({ ...form, domiciled: form.domiciled === "1", fx_rate: form.fx_rate || null }).then(setCheck);
    }, 300);
    return () => clearTimeout(timer);
  }, [form]);

  if (error) return <p className="text-[13px] text-bad">{error}</p>;
  if (!draft) return <p className="py-6 text-center text-[13px] text-fg-3">Preparando el comprobante…</p>;

  const set = (field: string) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const failed = check?.checks.filter((item) => !item.ok) ?? [];

  return (
    <>
      <input type="hidden" name="receivable_id" value={code} />
      <SummaryBox rows={[{ label: "Cuenta por cobrar", value: `${draft.receivable.code} · ${draft.receivable.concept}` }, { label: "Reserva", value: draft.reservation.code }, { label: "Pendiente de facturar", value: formatMoney(draft.maximum, draft.currency), strong: true }]} />
      <ChoiceGroup label="Comprobante" name="doc_type" defaultValue={draft.doc_type} onChange={set("doc_type")} options={[{ value: "01", label: "Factura" }, { value: "03", label: "Boleta" }]} />
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
        <SelectField label="Documento" name="customer_doc_type" options={DOC_OPTIONS} defaultValue={draft.customer_doc_type} onChange={set("customer_doc_type")} />
        <TextField label="Número" name="customer_doc_number" maxLength={20} defaultValue={draft.customer_doc_number} onChange={(event) => set("customer_doc_number")(event.target.value)} />
      </div>
      <TextField label="Razón social o nombre" name="customer_name" maxLength={200} defaultValue={draft.customer_name} onChange={(event) => set("customer_name")(event.target.value)} />
      <input type="hidden" name="customer_address" value={draft.customer_address ?? ""} />
      <ChoiceGroup label="Adquirente" name="domiciled" defaultValue={draft.domiciled ? "1" : "0"} onChange={set("domiciled")} options={[{ value: "1", label: "Domiciliado (con IGV)" }, { value: "0", label: "No domiciliado (exportación)" }]} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Importe (${draft.currency})`} name="amount" type="number" step="0.01" min="0.01" max={draft.maximum} defaultValue={draft.amount} onChange={(event) => set("amount")(event.target.value)} />
        {draft.currency !== "PEN" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.000001" defaultValue={draft.fx_rate ?? ""} onChange={(event) => set("fx_rate")(event.target.value)} />}
      </div>
      <TextArea label="Descripción" name="description" rows={2} maxLength={500} defaultValue={draft.description} onChange={(event) => set("description")(event.target.value)} />
      {check && (
        <div data-testid="invoice-check" data-state={check.ok ? "ok" : "error"} className={cn("rounded-xl px-3.5 py-3 text-[13px]", check.ok ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}>
          {check.ok ? (
            <p className="text-fg-2">
              {check.operation_type === "gravada" ? `Base ${formatMoney(check.taxable_amount, draft.currency)} + IGV ${formatMoney(check.igv_amount, draft.currency)}` : "Exportación sin IGV"} · <b className="text-fg">{formatMoney(check.total_amount, draft.currency)}</b>
              <span className="mt-0.5 block text-[12px] text-fg-3">{check.amount_in_words}</span>
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-bad">
              {failed.map((item) => (
                <li key={item.rule}>{item.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function IssueInvoiceAction({ item }: { item: InvoicePending }) {
  return (
    <FinanceStep step="invoice_issue" itemKey={item.code} label="Emitir" title="Emitir comprobante" description="Se numera con la serie del tipo elegido y se envía al OSE. La respuesta llega en segundos." submitLabel="Validar y emitir" trigger={(open) => <Button size="sm" variant="secondary" icon={<FilePlus2 size={15} />} onClick={open} data-testid={`invoice-issue:${item.code}`}>Emitir</Button>}>
      <IssueInvoiceFields code={item.code} />
    </FinanceStep>
  );
}

export function PendingInvoicing({ pending }: { pending: InvoicePending[] }) {
  if (pending.length === 0) return null;
  return (
    <Card className="mb-5">
      <TintCardTitle icon={FilePlus2} title="Cobrado por facturar" aside={String(pending.length)} />
      <ul className="flex flex-col">
        {pending.map((item) => (
          <li key={item.code} data-testid={`invoice-pending:${item.code}`} className="flex flex-wrap items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{item.client}</b>
              <span className="text-xs text-fg-3">
                {item.code} · {item.concept} · {item.reservation}
              </span>
            </span>
            <span className="font-mono text-[13px]">{formatMoney(item.pending, item.currency)}</span>
            <IssueInvoiceAction item={item} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
