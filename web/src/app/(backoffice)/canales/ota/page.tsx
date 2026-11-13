import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { OtaBoard, type MappingSet } from "@/features/growth/OtaBoard";
import type { OtaBooking, OtaMapping, OtaOverview, Option } from "@/lib/growth";
import { getCachedResource, getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "OTAs" };

export default async function OtaPage() {
  const [overview, bookings] = await Promise.all([
    getCachedResource<OtaOverview>("/channels/ota/connections", "No pudimos cargar las conexiones con OTAs."),
    getCachedResource<OtaBooking[]>("/channels/ota/bookings?page[size]=100", "No pudimos cargar las reservas recibidas."),
  ]);

  if (!overview) {
    return <PageHeader title="OTAs" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const active = overview.connections.filter((connection) => connection.status !== "desconectado");
  const mappings: MappingSet[] = (
    await Promise.all(
      active.map(async (connection) => {
        const data = await getResource<{ mappings: OtaMapping[]; products: (Option & { mapped: boolean })[] }>(`/channels/ota/connections/${encodeURIComponent(connection.code)}/mappings`, "No pudimos cargar los mapeos.");
        return data ? { code: connection.code, ...data } : null;
      }),
    )
  ).filter((set): set is MappingSet => set !== null);

  return (
    <>
      <PageHeader
        title="OTAs"
        subtitle="Conexiones con Viator, GetYourGuide, Expedia, Google Things to Do y Civitatis."
        info={<InfoTip>La disponibilidad que ve la OTA es la real menos los bloqueos vigentes. Una reserva sin cupo o de un producto sin mapeo se rechaza y se informa a la OTA.</InfoTip>}
      />
      <OtaBoard overview={overview} bookings={bookings ?? []} mappings={mappings} />
    </>
  );
}
