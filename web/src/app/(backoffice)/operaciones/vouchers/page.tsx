import { FileClock, TicketCheck, TicketX, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { PendingVouchers, VouchersTable } from "@/features/operations/Vouchers";
import type { VoucherOverview } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Vouchers" };

export default async function VouchersPage() {
  const data = await getResource<VoucherOverview>("/ops/vouchers", "No pudimos cargar los vouchers.");

  if (!data) {
    return <PageHeader title="Vouchers" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Vouchers"
        subtitle="Los comprobantes que el pasajero presenta a cada proveedor."
        info={<InfoTip>Solo los servicios confirmados por el proveedor emiten voucher, y cada servicio tiene uno vigente. Para corregirlo se emite una nueva versión con el mismo código.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={TicketCheck} tone="ok" label="Vigentes" value={data.kpis.issued} />
        <TintTile icon={CircleCheck} tone="violet" label="Utilizados" value={data.kpis.used} />
        <TintTile icon={TicketX} tone="bad" label="Anulados" value={data.kpis.voided} />
        <TintTile icon={FileClock} tone="warn" label="Confirmados sin voucher" value={data.kpis.pending} note="Listos para emitir" />
      </section>
      <PendingVouchers data={data} />
      <VouchersTable data={data} />
    </>
  );
}
