import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PriceRulesBoard } from "@/features/growth/PriceRulesBoard";
import type { PriceRulesPage } from "@/lib/growth";
import { getCachedResource } from "@/lib/server/resource";
import { apiFetch } from "@/lib/server/api";

export const metadata: Metadata = { title: "Precios dinámicos" };

export default async function PreciosDinamicosPage() {
  const access = await getCachedResource<unknown[]>("/catalog/dynamic-price-rules?page[size]=1", "No pudimos cargar las reglas de precio.");

  if (!access) {
    return <PageHeader title="Precios dinámicos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const result = await apiFetch<PriceRulesPage>("/catalog/dynamic-price-rules?page[size]=100", { raw: true });
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las reglas de precio.");

  return (
    <>
      <PageHeader
        title="Precios dinámicos"
        subtitle="Ajusta el precio por ocupación, anticipación, día de la semana, temporada o demanda."
        info={<InfoTip>Las reglas activas se suman por prioridad y el resultado queda entre el piso y el techo de las reglas aplicadas. Un cambio de regla no altera lo ya cotizado o vendido.</InfoTip>}
      />
      <PriceRulesBoard page={result.data} />
    </>
  );
}
