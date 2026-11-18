import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlanCards } from "@/features/platform/TenantsOverview";
import { TenantWizardAction } from "@/features/platform/TenantWizard";
import { TenantsTable } from "@/features/platform/TenantsTable";
import { formatMoney } from "@/lib/format";
import { getProvisionOptions, listPlans, listTenants } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Agencias" };

export default async function AgenciasPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const [tenants, options, plans, query] = await Promise.all([listTenants(), getProvisionOptions(), listPlans(), searchParams]);
  const monthly = tenants.reduce((total, tenant) => total + Number(tenant.mrr), 0);
  const plan = typeof query.plan === "string" && plans.some((item) => item.name === query.plan) ? query.plan : undefined;

  return (
    <>
      <PageHeader
        title="Agencias"
        subtitle={`${tenants.length} agencias · ${formatMoney(monthly)} de ingreso mensual`}
        actions={<TenantWizardAction options={options} />}
        info={<InfoTip>El ingreso mensual suma las suscripciones que se cobran, con sus complementos; las agencias en prueba y las suspendidas suman cero. Desde esta consola ves datos de cuenta y uso; la información comercial de cada agencia queda fuera de tu alcance.</InfoTip>}
      />
      <TenantsTable key={plan ?? "todas"} tenants={tenants} plans={plans} initialPlan={plan} />
      <h2 className="mb-3 mt-6 text-[15px] font-semibold">Agencias por plan</h2>
      <PlanCards tenants={tenants} plans={plans} current={plan} />
    </>
  );
}
