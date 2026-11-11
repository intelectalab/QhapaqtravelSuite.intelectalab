import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TravelDocTiles } from "@/features/operations/TravelDocSections";
import type { TravelDocList } from "@/lib/operations";
import { getCachedResource } from "@/lib/server/resource";

export default async function TravelDocsLayout({ children }: { children: ReactNode }) {
  const data = await getCachedResource<TravelDocList>("/ops/travel-docs", "No pudimos cargar los documentos de viaje.");

  if (!data) {
    return <PageHeader title="Documentos de viaje" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Documentos de viaje"
        subtitle={data.can.manage ? "Pasaportes, seguros y permisos de cada pasajero antes de salir." : "El avance documental de tus reservas."}
        info={<InfoTip>Un documento que vence antes del regreso queda marcado. Las entradas nominativas se emiten con el checklist completo.</InfoTip>}
      />
      <TravelDocTiles data={data} />
      <TabbedCard
        tabs={[
          { href: "/operaciones/documentos-viaje", label: "Por reserva", count: data.items.length },
          { href: "/operaciones/documentos-viaje/pasajeros", label: "Por pasajero", count: data.passengers.length },
          { href: "/operaciones/documentos-viaje/entradas-mapi", label: "Bloqueo de entradas MAPI", count: data.items.filter((row) => row.mapi !== null).length },
          { href: "/operaciones/documentos-viaje/reglas", label: "Reglas y recordatorios" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
