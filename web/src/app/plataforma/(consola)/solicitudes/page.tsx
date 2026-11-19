import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { DemoRequestsTable } from "@/features/platform/DemoRequestsTable";
import type { DemoRequestsOverview } from "@/lib/demoRequests";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Solicitudes de demo y prueba" };

export default async function DemoRequestsPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[] }> }) {
  const [overview, query] = await Promise.all([platformGet<DemoRequestsOverview>("/demo-requests"), searchParams]);
  const estado = typeof query.estado === "string" ? query.estado : undefined;

  return (
    <>
      <PageHeader
        title="Solicitudes de demo y prueba"
        subtitle="Agencias que pidieron una demo guiada o una prueba gratis desde la página de KipuControl."
        info={<InfoTip>Llegan del formulario de la página de venta. Cada cambio de estado guarda quién lo hizo y queda en la auditoría de la consola.</InfoTip>}
      />
      <DemoRequestsTable overview={overview} initialStatus={estado} />
    </>
  );
}
