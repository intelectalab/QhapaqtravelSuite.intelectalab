import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { InvoicesTable, IssueAnyInvoiceAction, PendingInvoicing } from "@/features/finance/Invoices";
import { OseNotice } from "@/features/finance/OseStatus";
import { getAgencyOse } from "@/lib/server/financeProviders";
import type { InvoiceInvoiceable, InvoiceKpis, InvoiceListMeta, InvoicePending, InvoiceRow } from "@/lib/finance";
import { REALMS } from "@/lib/realms";
import { fetchPages } from "@/lib/server/pages";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Facturación" };

export default async function FacturacionPage() {
  const list = await fetchPages<InvoiceRow, InvoiceListMeta>("/finance/invoices", 1000);
  if (list.status === 401) redirect(REALMS.agency.logout);
  if (list.status === 403 && list.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (!list.ok && list.status !== 403) throw new Error(list.error?.message ?? "No pudimos cargar los comprobantes.");
  const [summary, ose] = list.ok ? await Promise.all([getResource<{ kpis: InvoiceKpis; pending: InvoicePending[]; invoiceable: InvoiceInvoiceable[] }>("/finance/invoices/summary", "No pudimos cargar los cobros por facturar."), getAgencyOse()]) : [null, null];
  const data = list.ok && list.data && summary ? { ...list.data.meta, rows: list.data.data, pending: summary.pending, invoiceable: summary.invoiceable ?? [] } : null;

  if (!data) {
    return <PageHeader title="Facturación" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Facturas, boletas y notas de crédito y de débito electrónicas."
        info={<InfoTip>Cada comprobante se envía al OSE que eligió la agencia entre los homologados por KipuControl. El XML y la constancia de recepción (CDR) quedan guardados en la ficha del comprobante y en el portal del cliente. Un comprobante aceptado solo se anula o se rebaja con una nota de crédito; un cargo adicional sobre él va con una nota de débito.</InfoTip>}
        actions={data.can.issue ? <IssueAnyInvoiceAction options={data.invoiceable} /> : undefined}
      />
      {ose && <OseNotice data={ose} />}
      {data.can.issue && <PendingInvoicing pending={data.pending} />}
      <InvoicesTable data={data} />
    </>
  );
}
