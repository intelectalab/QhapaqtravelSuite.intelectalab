import { Download } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { ClientCreateAction } from "@/features/clients/ClientForms";
import { ClientsTable } from "@/features/clients/ClientsTable";
import { getClientFormOptions, listClients } from "@/lib/server/clients";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const [clients, options] = await Promise.all([listClients(), getClientFormOptions()]);
  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Personas y empresas que te compran viajes."
        info={<InfoTip>El total comprado suma sus reservas confirmadas y viajes realizados, en soles.</InfoTip>}
        actions={
          <>
            <Button icon={<Download size={16} />} className="max-sm:hidden">
              Exportar
            </Button>
            {options.canManage && <ClientCreateAction options={options} />}
          </>
        }
      />
      <ClientsTable clients={clients} />
    </>
  );
}
