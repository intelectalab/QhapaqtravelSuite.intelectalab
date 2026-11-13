import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { ClientCreateAction } from "@/features/clients/ClientForms";
import { ClientsTable } from "@/features/clients/ClientsTable";
import { getClientFormOptions, listClients } from "@/lib/server/clients";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/crm/clientes">) {
  const [clients, options, { nuevo }] = await Promise.all([listClients(), getClientFormOptions(), searchParams]);
  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Personas y empresas que te compran viajes."
        info={<InfoTip>El total comprado suma sus reservas confirmadas y viajes realizados, en soles. El saldo es lo que aún debe en cuentas por cobrar abiertas.</InfoTip>}
        actions={options.canManage ? <ClientCreateAction options={options} defaultOpen={nuevo === "1"} /> : undefined}
      />
      <ConsultModeNotice permissions={["crm.clients.manage"]} what="crear ni editar clientes" />
      <ClientsTable clients={clients} canManage={options.canManage} />
    </>
  );
}
