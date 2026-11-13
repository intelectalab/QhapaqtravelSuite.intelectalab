import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { CreateAccountAction } from "@/features/corporate/CorporateAccountForms";
import { CorporateAccountsTable } from "@/features/corporate/CorporateAccountsTable";
import type { CorporateAccountsPage, CorporateOptions } from "@/lib/corporate";
import { apiFetch } from "@/lib/server/api";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cuentas corporativas" };

export default async function CorporateAccountsListPage() {
  const result = await apiFetch<CorporateAccountsPage>("/crm/corporate-accounts?page[size]=100", { raw: true });

  if (!result.ok || !result.data) {
    return <PageHeader title="Cuentas corporativas" subtitle={result.status === 403 ? result.error?.message ?? "Tu rol no tiene acceso a esta sección." : "No pudimos cargar las cuentas corporativas."} />;
  }

  const options = await getResource<CorporateOptions>("/crm/corporate-accounts/form-options", "No pudimos cargar las opciones.");

  return (
    <>
      <PageHeader
        title="Cuentas corporativas"
        subtitle="Empresas que compran viajes para su personal: crédito, aprobación previa, centros de costo y usuarios del panel."
        info={<InfoTip>Cada cuenta habilita el Panel corporativo en el portal del cliente. El saldo es lo comprado menos pagos y notas de crédito; Ventas solo ve las empresas de su cartera.</InfoTip>}
        actions={options ? <CreateAccountAction options={options} /> : undefined}
      />
      <CorporateAccountsTable accounts={result.data.data} />
    </>
  );
}
