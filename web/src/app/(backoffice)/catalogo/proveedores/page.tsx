import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { ProviderCreateAction } from "@/features/catalog-providers/ProviderForms";
import { ProvidersTable } from "@/features/catalog-providers/ProvidersTable";
import { SupplyAlerts } from "@/features/catalog-shared/SupplyAlerts";
import type { ProvidersOverview } from "@/lib/catalog-providers";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  const overview = await getResource<ProvidersOverview>("/catalog/providers", "No pudimos cargar los proveedores.");

  if (!overview) {
    return <PageHeader title="Proveedores" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const expired = overview.providers.filter((provider) => provider.contract_days < 0);

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle="Hoteles, transportistas, guías y operadores con los que trabajas."
        info={<InfoTip>Un proveedor nace inactivo y se activa con su contrato vigente. Cuando el contrato vence, sus servicios dejan de poder usarse hasta renovarlo.</InfoTip>}
        actions={overview.can.manage ? <ProviderCreateAction overview={overview} /> : undefined}
      />
      <SupplyAlerts
        alerts={
          expired.length
            ? [{ key: "expired", tone: "bad", text: <><b className="font-semibold">{expired.length === 1 ? "1 proveedor tiene el contrato vencido" : `${expired.length} proveedores tienen el contrato vencido`}</b>: {expired.map((provider) => provider.name).join(", ")}. Sus servicios no se pueden usar hasta renovar el contrato desde su ficha.</> }]
            : []
        }
      />
      <ProvidersTable overview={overview} />
    </>
  );
}
