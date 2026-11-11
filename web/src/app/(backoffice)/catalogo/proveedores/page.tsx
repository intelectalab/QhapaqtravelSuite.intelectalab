import { Building2, CalendarClock, Layers, Star } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ProviderCreateAction } from "@/features/catalog-providers/ProviderForms";
import { ProvidersTable } from "@/features/catalog-providers/ProvidersTable";
import type { ProvidersOverview } from "@/lib/catalog-providers";
import { formatDate } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  const overview = await getResource<ProvidersOverview>("/catalog/providers", "No pudimos cargar los proveedores.");

  if (!overview) {
    return <PageHeader title="Proveedores" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const providers = overview.providers;
  const next = providers.filter((provider) => provider.state === "activo" && provider.contract_days >= 0).sort((a, b) => a.contract_end.localeCompare(b.contract_end))[0];
  const services = providers.reduce((sum, provider) => sum + provider.services.length, 0);
  const withoutServices = providers.filter((provider) => provider.services.length === 0).length;
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
        <TintTile icon={CalendarClock} tone="sun" label="Próximo fin de contrato" value={next ? formatDate(next.contract_end) : "—"} note={next ? next.name : "Ningún contrato activo por vencer"} info={<p>El proveedor activo cuyo contrato termina antes. Renuévalo desde su ficha para no bloquear sus servicios.</p>} />
        <TintTile icon={Layers} tone="t1" label="Servicios" value={services} note={withoutServices ? `${withoutServices} proveedores sin servicios` : "Todos tienen servicios"} info={<p>Servicios registrados entre todos los proveedores, activos o no.</p>} />
        <TintTile icon={Building2} tone="ok" label="Tipos" value={new Set(providers.map((provider) => provider.type)).size} note="Hotel, transporte, guía, operador y más" info={<p>Tipos distintos de proveedor registrados en tu agencia.</p>} />
        <TintTile icon={Star} tone="violet" label="Calificación promedio" value={average === null ? "—" : average.toFixed(1)} note={`${rated.length} proveedores calificados`} info={<p>Promedio simple de la calificación de 1 a 5 de los proveedores que ya tienen una.</p>} />
      </section>
      <Card>
        <ProvidersTable overview={overview} />
      </Card>
    </>
  );
}
