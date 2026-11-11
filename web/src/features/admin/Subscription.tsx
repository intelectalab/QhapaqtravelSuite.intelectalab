"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { PayInvoiceAction, SendInvoiceAction } from "./SubscriptionActions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/ui/Charts";
import { FieldList } from "@/components/ui/Details";
import { SidePanel } from "@/components/ui/SidePanel";
import type { PlatformInvoice, SubscriptionOverview } from "@/lib/admin";
import { formatDate, formatDateTime, formatMoney, formatNumber, monthName } from "@/lib/format";
import { UsageBar } from "./AdminParts";

const INVOICE_STATUS: Record<string, { label: string; tone: "ok" | "bad" | "sun" | "mute" }> = {
  paid: { label: "Pagada", tone: "ok" },
  open: { label: "Por pagar", tone: "sun" },
  failed: { label: "Cobro fallido", tone: "bad" },
  draft: { label: "Borrador", tone: "mute" },
  void: { label: "Anulada", tone: "mute" },
  uncollectible: { label: "Incobrable", tone: "bad" },
};

const INVOICE_KIND: Record<string, string> = { subscription: "Suscripción", proration: "Cambio de plan (prorrateo)", addon: "Complemento (prorrateo)", manual: "Cargo manual" };

const SUNAT: Record<string, string> = { accepted: "Aceptada por SUNAT", observed: "Observada", rejected: "Rechazada", pending: "Pendiente de envío" };

export function UsageGrid({ usage, columns = 3 }: { usage: SubscriptionOverview["usage"]; columns?: 2 | 3 }) {
  return (
    <div className={columns === 3 ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
      {usage.map((metric, index) => (
        <div key={metric.metric} style={{ animationDelay: `${index * 50}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <UsageBar used={metric.used} limit={metric.limit} label={metric.label} unit={metric.unit} note={metric.limit !== null && metric.used >= metric.limit * 0.8 ? (metric.hard ? "Cerca del límite: al llegar se bloquea" : "Cerca del límite") : undefined} />
        </div>
      ))}
    </div>
  );
}

const HISTORY_METRICS = [
  { id: "reservations_month", label: "Reservas" },
  { id: "whatsapp_month", label: "WhatsApp" },
  { id: "email_month", label: "Correos" },
  { id: "api_calls_month", label: "API" },
];

export function UsageHistory({ history, metrics = HISTORY_METRICS }: { history: SubscriptionOverview["history"]; metrics?: { id: string; label: string }[] }) {
  const tabs = metrics.filter((tab) => (history[tab.id] ?? []).length > 0);
  const [metric, setMetric] = useState<string>(tabs[0]?.id ?? metrics[0]?.id ?? "");
  const series = history[metric] ?? [];
  if (tabs.length === 0) return <p className="text-[13px] text-fg-3">Aún no hay consumo registrado.</p>;
  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-control bg-surface-2 p-1">
        {tabs.length > 1 && tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setMetric(tab.id)} className={metric === tab.id ? "rounded-[10px] bg-surface px-3 py-1.5 text-[12.5px] font-semibold shadow-card" : "rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold text-fg-3 hover:text-fg"}>
            {tab.label}
          </button>
        ))}
      </div>
      <BarChart
        key={metric}
        data={series.map((point, index) => ({
          label: monthName(point.month).slice(0, 3),
          value: point.value,
          caption: formatNumber(point.value),
          detail: `${monthName(point.month)}: ${formatNumber(point.value)}`,
          highlight: index === series.length - 1,
        }))}
      />
    </div>
  );
}

function InvoiceDetail({ invoice, manage }: { invoice: PlatformInvoice; manage: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label="Ver factura" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={`Factura ${invoice.number}`} description={`Periodo del ${formatDate(invoice.period_from)} al ${formatDate(invoice.period_to)}`}>
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-line-2 rounded-[14px] border border-line">
            {invoice.lines.map((line) => (
              <li key={line.description} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span>
                  {line.description}
                  {line.quantity > 1 && <span className="text-fg-3"> × {line.quantity}</span>}
                </span>
                <b className="flex-none font-semibold">{formatMoney(line.amount, invoice.currency)}</b>
              </li>
            ))}
          </ul>
          <FieldList
            fields={[
              { label: "Subtotal", value: formatMoney(invoice.subtotal, invoice.currency) },
              { label: "IGV", value: formatMoney(invoice.igv, invoice.currency) },
              { label: "Total", value: <b>{formatMoney(invoice.total, invoice.currency)}</b> },
              { label: "Pago", value: invoice.paid_at ? `${formatDateTime(invoice.paid_at)} · ${invoice.method ?? ""}` : "Pendiente" },
              { label: "SUNAT", value: SUNAT[invoice.sunat] ?? invoice.sunat },
            ]}
          />
          {manage && ["open", "failed"].includes(invoice.status) && (
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-3.5 py-3">
              <p className="text-[12.5px] text-fg-2">{invoice.status === "failed" ? "El último cobro fue rechazado." : `Vence el ${formatDate(invoice.due_date)}.`}</p>
              <PayInvoiceAction number={invoice.number} total={invoice.total} currency={invoice.currency} />
            </div>
          )}
          {manage && <SendInvoiceAction number={invoice.number} />}
        </div>
      </SidePanel>
    </>
  );
}

export function InvoicesTable({ invoices, manage = false }: { invoices: PlatformInvoice[]; manage?: boolean }) {
  const columns: Column<PlatformInvoice>[] = [
    {
      id: "number",
      header: "Factura",
      mobile: "title",
      cell: (invoice) => (
        <span>
          <b className="block font-mono text-[13px] font-semibold">{invoice.number}</b>
          <span className="text-[11.5px] text-fg-3">Emitida el {formatDate(invoice.issue_date)}</span>
        </span>
      ),
    },
    { id: "kind", header: "Concepto", wideOnly: true, cell: (invoice) => <span className="text-[13px] text-fg-2">{INVOICE_KIND[invoice.kind] ?? invoice.kind}</span> },
    { id: "period", header: "Periodo", cell: (invoice) => <span className="text-[13px]">{formatDate(invoice.period_from)} – {formatDate(invoice.period_to)}</span> },
    { id: "total", header: "Total", align: "right", cell: (invoice) => <b className="font-semibold">{formatMoney(invoice.total, invoice.currency)}</b> },
    { id: "status", header: "Estado", cell: (invoice) => <Badge tone={INVOICE_STATUS[invoice.status]?.tone ?? "mute"}>{INVOICE_STATUS[invoice.status]?.label ?? invoice.status}</Badge> },
    { id: "sunat", header: "SUNAT", wideOnly: true, cell: (invoice) => <span className="text-[12.5px] text-fg-3">{SUNAT[invoice.sunat] ?? invoice.sunat}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (invoice) => (
        <RowActions>
          <InvoiceDetail invoice={invoice} manage={manage} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<PlatformInvoice>[] = [
    { id: "paid", label: "Pagadas", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (invoice) => invoice.status === "paid" },
    { id: "due", label: "Por pagar o fallidas", tone: "bad", icon: <XCircle size={19} />, matches: (invoice) => ["open", "failed"].includes(invoice.status) },
  ];
  const filters: FilterConfig<PlatformInvoice>[] = [{ id: "status", label: "Estado", options: Object.entries(INVOICE_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (invoice) => invoice.status }];
  const sorts: SortOption<PlatformInvoice>[] = [
    { id: "issue", label: "Emisión", type: "date", value: (invoice) => invoice.issue_date },
    { id: "total", label: "Total", type: "number", value: (invoice) => invoice.total },
  ];
  return <DataTable screen="admin-facturas-plataforma" rows={invoices} columns={columns} getKey={(invoice) => invoice.number} entityLabel="facturas" searchText={(invoice) => `${invoice.number} ${invoice.lines.map((line) => line.description).join(" ")}`} searchPlaceholder="Buscar factura" metrics={metrics} filters={filters} sorts={sorts} />;
}
