"use client";

import { Ban, CircleAlert, CircleCheck, Clock, FileWarning } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_STATUS, invoicePeriod, isCollectible, SUNAT_STATUS, type InvoiceSummary } from "@/lib/platformBilling";
import { ManualPaymentAction, RetryChargeAction, VoidInvoiceAction } from "./InvoiceActions";

const href = (invoice: InvoiceSummary) => `/plataforma/facturacion/facturas/${invoice.id}`;

const recovered = (invoice: InvoiceSummary) => invoice.status === "paid" && invoice.attempts > 1;

const KIND: Record<InvoiceSummary["kind"], string> = { subscription: "Suscripción", proration: "Prorrateo", addon: "Complemento", manual: "Manual" };

const columns: Column<InvoiceSummary>[] = [
  {
    id: "number",
    header: "Factura",
    mobile: "title",
    cell: (invoice) => (
      <div className="min-w-0">
        <Link href={href(invoice)} className="font-mono text-[13px] font-semibold hover:underline">
          {invoice.number}
        </Link>
        <small className="block text-xs text-fg-3">
          {KIND[invoice.kind]} · {invoicePeriod(invoice)}
        </small>
      </div>
    ),
  },
  {
    id: "tenant",
    header: "Agencia",
    cell: (invoice) => (
      <Link href={`/plataforma/agencias/${invoice.tenant.code}`} className="flex items-center gap-2.5 hover:underline">
        <Avatar name={invoice.tenant.name} />
        <span className="min-w-0">
          <b className="block truncate text-[13.5px] font-semibold">{invoice.tenant.name}</b>
          <small className="block text-xs text-fg-3">Plan {invoice.plan.name}</small>
        </span>
      </Link>
    ),
  },
  { id: "issue", header: "Emisión", wideOnly: true, cell: (invoice) => <span className="text-[13px]">{formatDate(invoice.issue_date)}</span> },
  { id: "total", header: "Total", align: "right", cell: (invoice) => <span className="font-mono text-[13.5px] font-semibold">{formatMoney(invoice.total, invoice.currency)}</span> },
  {
    id: "attempts",
    header: "Intentos",
    align: "right",
    wideOnly: true,
    cell: (invoice) => (
      <span className="flex flex-col items-end">
        <span className="font-mono text-[13px]">{invoice.attempts}</span>
        {recovered(invoice) && <small className="text-[11.5px] font-semibold text-ok">recuperado</small>}
      </span>
    ),
  },
  {
    id: "status",
    header: "Estado",
    cell: (invoice) => (
      <span className="flex flex-col items-start gap-1">
        <Badge tone={INVOICE_STATUS[invoice.status].tone}>{INVOICE_STATUS[invoice.status].label}</Badge>
        {invoice.credit_note && <small className="font-mono text-[11.5px] text-fg-3">{invoice.credit_note}</small>}
      </span>
    ),
  },
  { id: "sunat", header: "SUNAT", wideOnly: true, cell: (invoice) => <Badge tone={SUNAT_STATUS[invoice.sunat_status]?.tone ?? "mute"} dot={false}>{SUNAT_STATUS[invoice.sunat_status]?.label ?? invoice.sunat_status}</Badge> },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (invoice) => (
      <RowActions>
        <RowIcon tone="view" label="Ver factura" href={href(invoice)} />
        {isCollectible(invoice) && <RetryChargeAction invoice={invoice} row />}
        {isCollectible(invoice) && <ManualPaymentAction invoice={invoice} row />}
        {invoice.status === "void" ? <RowIcon tone="delete" label="Anular" disabledHint="La factura ya está anulada" /> : <VoidInvoiceAction invoice={invoice} row />}
      </RowActions>
    ),
  },
];

const metrics: MetricFilter<InvoiceSummary>[] = [
  { id: "paid", label: "Pagadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (invoice) => invoice.status === "paid" },
  { id: "open", label: "Por cobrar", tone: "info", icon: <Clock size={19} />, matches: (invoice) => invoice.status === "open" },
  { id: "failed", label: "Cobro fallido", tone: "bad", icon: <CircleAlert size={19} />, matches: (invoice) => invoice.status === "failed" },
  { id: "uncollectible", label: "Incobrables", tone: "warn", icon: <FileWarning size={19} />, matches: (invoice) => invoice.status === "uncollectible" },
  { id: "void", label: "Anuladas", tone: "mute", icon: <Ban size={19} />, matches: (invoice) => invoice.status === "void" },
];

const sorts: SortOption<InvoiceSummary>[] = [
  { id: "issue", label: "Fecha de emisión", type: "date", value: (invoice) => invoice.issue_date },
  { id: "total", label: "Total", type: "number", value: (invoice) => invoice.total },
  { id: "attempts", label: "Intentos", type: "number", value: (invoice) => invoice.attempts },
  { id: "number", label: "Número", type: "text", value: (invoice) => invoice.number },
];

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function InvoicesTable({ invoices }: { invoices: InvoiceSummary[] }) {
  const filters: FilterConfig<InvoiceSummary>[] = [
    { id: "tenant", label: "Agencia", options: unique(invoices.map((invoice) => invoice.tenant.name)), value: (invoice) => invoice.tenant.name },
    { id: "kind", label: "Tipo", options: unique(invoices.map((invoice) => KIND[invoice.kind])), value: (invoice) => KIND[invoice.kind] },
    { id: "month", label: "Mes de emisión", options: unique(invoices.map((invoice) => invoice.issue_date.slice(0, 7))).reverse(), value: (invoice) => invoice.issue_date.slice(0, 7) },
  ];

  return (
    <DataTable
      screen="plataforma-facturas"
      rows={invoices}
      columns={columns}
      getKey={(invoice) => invoice.id}
      entityLabel="facturas"
      searchText={(invoice) => `${invoice.number} ${invoice.tenant.name} ${invoice.tenant.code} ${invoice.credit_note ?? ""}`}
      searchPlaceholder="Buscar factura o agencia"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      footer={(rows) => ({ number: `Total (${rows.length})`, total: <span className="font-mono">{formatMoney(rows.reduce((sum, invoice) => sum + invoice.total, 0), rows[0]?.currency ?? "PEN")}</span> })}
    />
  );
}
