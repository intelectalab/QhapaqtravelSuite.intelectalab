import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PaymentsTable } from "@/features/finance/Payments";
import type { PaymentsOverview } from "@/lib/finance";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Pagos y aplicaciones" };

export default async function PagosPage() {
  const data = await getResource<PaymentsOverview>("/finance/payments", "No pudimos cargar los pagos.");

  if (!data) {
    return <PageHeader title="Pagos y aplicaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Pagos y aplicaciones"
        subtitle="Pagos recibidos, su validación y la cuota que saldan."
        info={<InfoTip>Un pago reportado por un asesor o por el cliente queda pendiente hasta que Finanzas lo valida. Revertir lo desaplica de la cuota y recalcula el saldo.</InfoTip>}
      />
      <PaymentsTable data={data} />
    </>
  );
}
