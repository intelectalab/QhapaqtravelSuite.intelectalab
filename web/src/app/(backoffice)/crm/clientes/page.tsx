import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { ClientsTable } from "@/features/clients/ClientsTable";
import { listClients } from "@/lib/server/clients";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const clients = await listClients();
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
            <Button variant="primary" iconOnlyOnMobile icon={<Plus size={16} strokeWidth={2.4} />}>
              Nuevo cliente
            </Button>
          </>
        }
      />
      <ClientsTable clients={clients} />
    </>
  );
}
