import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TenantCreateAction } from "@/features/platform/TenantCreateAction";
import { TenantsTable } from "@/features/platform/TenantsTable";
import { formatMoney } from "@/lib/format";
import { listPlans, listTenants } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Agencias" };

export default async function AgenciasPage() {
  const [tenants, plans] = await Promise.all([listTenants(), listPlans()]);
  const monthly = tenants.filter((tenant) => tenant.status === "activo").reduce((total, tenant) => total + Number(tenant.mrr), 0);

  return (
    <>
      <PageHeader
        title="Agencias"
        subtitle={`${tenants.length} agencias · ${formatMoney(monthly)} de ingreso mensual`}
        actions={<TenantCreateAction plans={plans} />}
        info={<InfoTip>El ingreso mensual suma solo las agencias activas. Desde esta consola ves datos de cuenta y uso; la información comercial de cada agencia queda fuera de tu alcance.</InfoTip>}
      />
      <TenantsTable tenants={tenants} />
    </>
  );
}
