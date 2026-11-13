import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { RecoveryBoard } from "@/features/growth/RecoveryBoard";
import type { RecoveryAttempt, RecoveryOverview } from "@/lib/growth";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Recuperación de ventas" };

export default async function RecuperacionPage() {
  const [overview, attempts] = await Promise.all([
    getCachedResource<RecoveryOverview>("/marketing/recovery-flows", "No pudimos cargar los flujos de recuperación."),
    getCachedResource<RecoveryAttempt[]>("/marketing/recovery-attempts?page[size]=100", "No pudimos cargar los intentos."),
  ]);

  if (!overview) {
    return <PageHeader title="Recuperación de ventas" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Recuperación de ventas"
        subtitle="Mensajes automáticos para carritos y cotizaciones que quedaron sin avanzar."
        info={<InfoTip>No se escribe a quien no autorizó el canal, a quien ya compró ni después del máximo de intentos. Entre un intento y otro pasa al menos la espera configurada.</InfoTip>}
      />
      <RecoveryBoard overview={overview} attempts={attempts ?? []} />
    </>
  );
}
