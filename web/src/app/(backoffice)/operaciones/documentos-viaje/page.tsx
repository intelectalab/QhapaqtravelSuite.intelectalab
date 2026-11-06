import { CircleAlert, Clock3, Plane, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { TravelDocsTable } from "@/features/operations/TravelDocs";
import type { TravelDocList } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Documentos de viaje" };

export default async function DocumentosViajePage() {
  const data = await getResource<TravelDocList>("/ops/travel-docs", "No pudimos cargar los documentos de viaje.");

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
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={ShieldCheck} tone="ok" label="Listos para viajar" value={data.kpis.ready} note="Checklist completo" />
        <TintTile icon={Clock3} tone="info" label="Archivos por revisar" value={data.kpis.to_review} />
        <TintTile icon={CircleAlert} tone="bad" label="Observados o vencidos" value={data.kpis.observed} />
        <TintTile icon={Plane} tone="warn" label="Salen pronto" value={data.kpis.soon} note="En 15 días, incompletos" />
      </section>
      <TravelDocsTable data={data} />
    </>
  );
}
