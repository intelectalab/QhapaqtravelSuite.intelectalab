import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AgencyShowcaseTabs, AgencyTiles, ListingFormAction, UpgradeBanner } from "@/features/vitrina/ShowcaseAgency";
import { getResource } from "@/lib/server/resource";
import type { AgencyShowcase, ShowcaseBooking, ShowcaseFees } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Vitrina Rutas Libres" };

export default async function ShowcasePage() {
  const [data, bookings, fees] = await Promise.all([
    getResource<AgencyShowcase>("/channels/showcase/listings", "No pudimos cargar la vitrina."),
    getResource<{ items: ShowcaseBooking[] }>("/channels/showcase/bookings", "No pudimos cargar las reservas de la vitrina."),
    getResource<ShowcaseFees>("/channels/showcase/fees", "No pudimos cargar los cargos de la vitrina."),
  ]);

  if (!data || !bookings || !fees) {
    return <PageHeader title="Vitrina Rutas Libres" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Vitrina Rutas Libres"
        subtitle="Sus tours en la vitrina gratuita multiagencia. Las reservas llegan con nombre y correo; los tours de pago pagan comisión según su plan."
        info={<InfoTip>Cada publicación pasa por moderación de la plataforma: fotos y textos propios, punto de encuentro real y agencia verificada. Marcar la asistencia alimenta el ranking y las reseñas verificadas.</InfoTip>}
        actions={<ListingFormAction options={data.options} />}
      />
      <AgencyTiles data={data} />
      <UpgradeBanner data={data} />
      <AgencyShowcaseTabs data={data} bookings={bookings.items} fees={fees} />
    </>
  );
}
