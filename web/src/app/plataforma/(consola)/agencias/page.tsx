import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TenantsTable } from "@/features/platform/TenantsTable";
import { formatMoney } from "@/lib/format";
import { listTenants } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Agencias" };

export default async function AgenciasPage() {
  const tenants = await listTenants();
  const monthly = tenants.filter((tenant) => tenant.status === "activo").reduce((total, tenant) => total + Number(tenant.mrr), 0);

  return (
    <>
      <PageHeader
        title="Agencias"
        subtitle={`${tenants.length} agencias · ${formatMoney(monthly)} de ingreso mensual`}
        info={<InfoTip>El ingreso mensual suma solo las agencias activas. Desde esta consola ves datos de cuenta y uso; la información comercial de cada agencia queda fuera de tu alcance.</InfoTip>}
      />
      <TenantsTable tenants={tenants} />
    </>
  );
}
