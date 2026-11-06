import { Building2, CircleCheck, FileClock, Star } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ProviderCreateAction } from "@/features/catalog-providers/ProviderForms";
import { ProvidersTable } from "@/features/catalog-providers/ProvidersTable";
import type { ProvidersOverview } from "@/lib/catalog-providers";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  const overview = await getResource<ProvidersOverview>("/catalog/providers", "No pudimos cargar los proveedores.");

  if (!overview) {
    return <PageHeader title="Proveedores" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const providers = overview.providers;
  const active = providers.filter((provider) => provider.state === "activo");
  const expiring = providers.filter((provider) => provider.contract_days >= 0 && provider.contract_days <= 95);
  const rated = providers.filter((provider) => provider.rating > 0);
  const average = rated.length ? rated.reduce((sum, provider) => sum + provider.rating, 0) / rated.length : null;

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle="Hoteles, transportistas, guías y operadores con los que trabajas."
        info={<InfoTip>Un proveedor nace inactivo y se activa con su contrato vigente. Cuando el contrato vence, sus servicios dejan de poder usarse hasta renovarlo.</InfoTip>}
        actions={overview.can.manage ? <ProviderCreateAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CircleCheck} tone="ok" label="Activos" value={active.length} note={`de ${providers.length} proveedores`} />
        <TintTile icon={FileClock} tone="sun" label="Contratos por vencer" value={expiring.length} note="En los próximos 95 días" />
        <TintTile icon={Building2} tone="t1" label="Tipos" value={new Set(providers.map((provider) => provider.type)).size} note={`${providers.reduce((sum, provider) => sum + provider.services.length, 0)} servicios en total`} />
        <TintTile icon={Star} tone="violet" label="Calificación promedio" value={average === null ? "—" : average.toFixed(1)} note={`${rated.length} proveedores calificados`} />
      </section>
      <Card>
        <ProvidersTable overview={overview} />
      </Card>
    </>
  );
}
