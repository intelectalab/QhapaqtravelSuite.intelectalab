"use client";

import { CheckCircle2, Mail, MapPin, XCircle } from "lucide-react";
import { useState } from "react";
import { updateBilling } from "@/app/(backoffice)/admin/suscripcion/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/ui/Charts";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, type AdminActionState, type PlatformInvoice, type SubscriptionOverview } from "@/lib/admin";
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

const SUNAT: Record<string, string> = { accepted: "Aceptada por SUNAT", observed: "Observada", rejected: "Rechazada", pending: "Pendiente de envío" };

export function UsageGrid({ usage }: { usage: SubscriptionOverview["usage"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {usage.map((metric, index) => (
        <div key={metric.metric} style={{ animationDelay: `${index * 50}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <UsageBar used={metric.used} limit={metric.limit} label={metric.label} unit={metric.unit} note={metric.limit !== null && metric.used >= metric.limit * 0.8 ? (metric.hard ? "Cerca del límite: al llegar se bloquea" : "Cerca del límite") : undefined} />
        </div>
      ))}
    </div>
  );
}

export function UsageHistory({ history }: { history: SubscriptionOverview["history"] }) {
  const [metric, setMetric] = useState<string>("reservations_month");
  const series = history[metric] ?? [];
  const tabs = [
    { id: "reservations_month", label: "Reservas" },
    { id: "whatsapp_month", label: "WhatsApp" },
    { id: "email_month", label: "Correos" },
    { id: "api_calls_month", label: "API" },
  ].filter((tab) => (history[tab.id] ?? []).length > 0);
  if (tabs.length === 0) return <p className="text-[13px] text-fg-3">Aún no hay consumo registrado.</p>;
  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-control bg-surface-2 p-1">
        {tabs.map((tab) => (
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

function InvoiceDetail({ invoice }: { invoice: PlatformInvoice }) {
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
        </div>
      </SidePanel>
    </>
  );
}

export function InvoicesTable({ invoices }: { invoices: PlatformInvoice[] }) {
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
          <InvoiceDetail invoice={invoice} />
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

export function BillingCard({ subscription, manage }: { subscription: NonNullable<SubscriptionOverview["subscription"]>; manage: boolean }) {
  const billing = subscription.billing;
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12.5px] text-fg-3">Se copian a cada factura al emitirla; las ya emitidas no cambian.</p>
        {manage && (
          <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId="billing-edit" trigger={(open) => <RowIcon tone="edit" label="Editar datos de facturación" onClick={open} />} title="Datos de facturación" description="Aplican desde la próxima factura." submitLabel="Guardar" action={updateBilling} initial={ADMIN_INITIAL}>
            {() => (
              <>
                <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} defaultValue={billing.ruc} />
                <TextField label="Razón social" name="name" required defaultValue={billing.name} />
                <TextField label="Dirección fiscal" name="address" required defaultValue={billing.address} icon={<MapPin size={17} />} />
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
                  <TextField label="Ubigeo" name="ubigeo" inputMode="numeric" maxLength={6} defaultValue={billing.ubigeo ?? undefined} />
                  <TextField label="Correo para facturas" name="email" type="email" required defaultValue={billing.email} icon={<Mail size={17} />} />
                </div>
              </>
            )}
          </PanelAction>
        )}
      </div>
      <FieldList
        fields={[
          { label: "RUC", value: <span className="font-mono">{billing.ruc}</span> },
          { label: "Razón social", value: billing.name },
          { label: "Dirección", value: billing.address },
          { label: "Correo", value: billing.email },
        ]}
      />
    </>
  );
}
