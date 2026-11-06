import { CircleCheck, Receipt, TriangleAlert, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { InvoicesTable } from "@/features/finance/Invoices";
import type { InvoicesOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Facturación" };

export default async function FacturacionPage() {
  const data = await getResource<InvoicesOverview>("/finance/invoices", "No pudimos cargar los comprobantes.");

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
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Receipt} tone="t1" label="Emitido este mes" value={formatMoney(kpis.month_pen, "PEN", { compact: true })} note={kpis.month_count === 1 ? "1 comprobante" : `${kpis.month_count} comprobantes`} />
        <TintTile icon={CircleCheck} tone="ok" label="Aceptados por el OSE" value={kpis.accepted} />
        <TintTile icon={TriangleAlert} tone={kpis.observed > 0 ? "warn" : "mute"} label="Observados" value={kpis.observed} note={kpis.observed > 0 ? "Revisa la observación del OSE" : "Sin observaciones"} />
        <TintTile icon={WalletCards} tone="violet" label="Cobrado por facturar" value={formatMoney(kpis.uninvoiced_pen, "PEN", { compact: true })} note={kpis.credit_notes_pen > 0 ? `Notas de crédito: ${formatMoney(kpis.credit_notes_pen, "PEN", { compact: true })}` : undefined} />
      </section>
      <InvoicesTable data={data} />
    </>
  );
}
