import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
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
      <PendingVouchers data={data} />
      <VouchersTable data={data} />
    </>
  );
}
