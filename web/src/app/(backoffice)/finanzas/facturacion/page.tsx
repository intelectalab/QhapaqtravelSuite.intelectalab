import { CircleCheck, Receipt, TriangleAlert, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { InvoicesTable, IssueAnyInvoiceAction, PendingInvoicing } from "@/features/finance/Invoices";
import type { InvoiceInvoiceable, InvoiceKpis, InvoiceListMeta, InvoicePending, InvoiceRow } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { REALMS } from "@/lib/realms";
import { fetchPages } from "@/lib/server/pages";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Facturación" };

export default async function FacturacionPage() {
  const list = await fetchPages<InvoiceRow, InvoiceListMeta>("/finance/invoices", 1000);
  if (list.status === 401) redirect(REALMS.agency.logout);
  if (list.status === 403 && list.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (!list.ok && list.status !== 403) throw new Error(list.error?.message ?? "No pudimos cargar los comprobantes.");
  const summary = list.ok ? await getResource<{ kpis: InvoiceKpis; pending: InvoicePending[]; invoiceable: InvoiceInvoiceable[] }>("/finance/invoices/summary", "No pudimos cargar los cobros por facturar.") : null;
  const data = list.ok && list.data && summary ? { ...list.data.meta, rows: list.data.data, pending: summary.pending, invoiceable: summary.invoiceable ?? [] } : null;

  if (!data) {
    return <PageHeader title="Facturación" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Facturas, boletas y notas de crédito electrónicas."
        info={<InfoTip>La conexión con el OSE todavía es simulada: el proveedor fiscal, sus series y sus plazos deben validarse con el contador antes de usarla en producción. Un comprobante aceptado solo se anula con una nota de crédito.</InfoTip>}
        actions={data.can.issue ? <IssueAnyInvoiceAction options={data.invoiceable} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Receipt} tone="t1" label="Emitido este mes" value={formatMoney(kpis.month_pen, "PEN", { compact: true })} note={kpis.month_count === 1 ? "1 comprobante" : `${kpis.month_count} comprobantes`} info="Suma en soles de las facturas y boletas emitidas este mes y ya enviadas al OSE, sin notas de crédito, anuladas ni rechazadas. La nota cuenta los comprobantes." />
        <TintTile icon={CircleCheck} tone="ok" label="Aceptados por el OSE" value={kpis.accepted} info="Comprobantes con respuesta de aceptación del operador de servicios electrónicos." />
        <TintTile icon={TriangleAlert} tone={kpis.observed > 0 ? "warn" : "mute"} label="Observados" value={kpis.observed} note={kpis.rejected ? `${kpis.rejected} rechazados: emite uno nuevo` : kpis.waiting > 0 ? `${kpis.waiting} esperando respuesta del OSE` : kpis.observed > 0 ? "Revisa la observación del OSE" : "Sin observaciones"} info="Comprobantes que el OSE aceptó con observaciones (siguen siendo válidos). La nota avisa de los rechazados, que no valen y hay que volver a emitir, y de los que aún esperan respuesta." />
        <TintTile icon={WalletCards} tone="violet" label="Cobrado por facturar" value={formatMoney(kpis.uninvoiced_pen, "PEN", { compact: true })} note={kpis.credit_notes_pen > 0 ? `Notas de crédito: ${formatMoney(kpis.credit_notes_pen, "PEN", { compact: true })}` : undefined} info="Cobros aplicados de cada reserva que todavía no tienen factura o boleta, en soles. La nota suma las notas de crédito emitidas." />
      </section>
      {data.can.issue && <PendingInvoicing pending={data.pending} />}
      <InvoicesTable data={data} />
    </>
  );
}
