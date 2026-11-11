import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { InvoicesTable } from "@/features/platform/InvoicesTable";
import { listPlatformInvoices } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Facturas de plataforma" };

export default async function FacturasPage() {
  const invoices = await listPlatformInvoices();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Facturas electrónicas que KipuControl Cloud emite a cada agencia, serie FQ01."
        info={<InfoTip>Anular emite una nota de crédito NQ01 y, si la factura estaba pagada, solicita el reembolso a la pasarela. Los montos incluyen IGV.</InfoTip>}
      />
      <BillingTabs />
      <InvoicesTable invoices={invoices} />
    </>
  );
}
