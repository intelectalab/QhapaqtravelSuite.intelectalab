"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { PayInvoiceAction, SendInvoiceAction } from "./SubscriptionActions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/ui/Charts";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { FieldList } from "@/components/ui/Details";
import { SidePanel } from "@/components/ui/SidePanel";
import type { PlatformInvoice, SubscriptionOverview } from "@/lib/admin";
import { formatDate, formatDateTime, formatMoney, formatNumber, monthName } from "@/lib/format";
import { ATTEMPT_SOURCE } from "@/lib/platformBilling";
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

export function UsageHistory({ history, metrics = HISTORY_METRICS, limits = {} }: { history: SubscriptionOverview["history"]; metrics?: { id: string; label: string }[]; limits?: Record<string, number | null> }) {
  const tabs = metrics.filter((tab) => (history[tab.id] ?? []).length > 0);
  const [metric, setMetric] = useState<string>(tabs[0]?.id ?? metrics[0]?.id ?? "");
  const series = history[metric] ?? [];
  const limit = limits[metric] ?? null;
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
        reference={limit !== null && limit > 0 ? { value: limit, label: `Límite vigente: ${formatNumber(limit)} al mes` } : undefined}
      />
      {limit !== null && limit > 0 && <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-3"><span aria-hidden className="inline-block w-5 border-t border-dashed border-bad/60" />Límite vigente del plan: {formatNumber(limit)} al mes</p>}
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
            ]}
          />
          {invoice.bill_to && (
            <section className="rounded-[14px] border border-line px-3.5 py-3">
              <h3 className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Facturar a</h3>
              <p className="text-[13.5px] font-semibold">{invoice.bill_to.name}</p>
              {invoice.bill_to.ruc && <p className="font-mono text-[12.5px] text-fg-2">RUC {invoice.bill_to.ruc}</p>}
              {invoice.bill_to.address && <p className="text-[12.5px] text-fg-2">{invoice.bill_to.address}</p>}
            </section>
          )}
          <section className="rounded-[14px] border border-line px-3.5 py-3">
            <h3 className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Comprobante electrónico</h3>
            <FieldList
              fields={[
                { label: "Estado SUNAT", value: <Badge tone={invoice.sunat === "accepted" ? "ok" : invoice.sunat === "rejected" ? "bad" : invoice.sunat === "observed" ? "sun" : "mute"}>{SUNAT[invoice.sunat] ?? invoice.sunat}</Badge> },
                ...(invoice.sunat_hash ? [{ label: "Código hash", value: <span className="break-all font-mono text-[12px]">{invoice.sunat_hash}</span> }] : []),
              ]}
            />
          </section>
          <section>
            <h3 className="mb-2 text-[12.5px] font-semibold text-fg-3">Intentos de cobro · {invoice.attempts.length}</h3>
            {invoice.attempts.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">Todavía no se intentó cobrar esta factura.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-2 rounded-[14px] border border-line">
                {invoice.attempts.map((attempt) => (
                  <li key={attempt.number} className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-surface-2">
                    <span className={attempt.result === "succeeded" ? "mt-0.5 text-ok" : "mt-0.5 text-bad"}>{attempt.result === "succeeded" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block font-semibold">{ATTEMPT_SOURCE[attempt.source] ?? attempt.source}</b>
                      {attempt.message && <span className="block text-[12.5px] text-fg-2">{attempt.message}</span>}
                    </span>
                    <span className="flex-none text-[12px] text-fg-3">{formatDateTime(attempt.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {manage && ["open", "failed"].includes(invoice.status) && (
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-3.5 py-3">
              <p className="text-[12.5px] text-fg-2">{invoice.status === "failed" ? "El último cobro fue rechazado." : `Vence el ${formatDate(invoice.due_date)}.`}</p>
              <PayInvoiceAction numbers={[invoice.number]} total={invoice.total} currency={invoice.currency} />
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
          {invoice.status !== "draft" && <DownloadButton href={`/admin/suscripcion/facturas/${encodeURIComponent(invoice.number)}/pdf`} label="Descargar PDF" size="sm" iconOnly />}
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
