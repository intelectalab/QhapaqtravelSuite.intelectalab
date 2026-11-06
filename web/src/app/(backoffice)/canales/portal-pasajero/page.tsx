import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { PassengerTiles, PassengerWorkspace } from "@/features/channels/PassengerPortal";
import type { PassengerPortalOverview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Portal del pasajero" };

export default async function PassengerPortalPage() {
  const overview = await getResource<PassengerPortalOverview>("/channels/passenger-portal", "No pudimos cargar el portal del pasajero.");

  if (!overview) {
    return <PageHeader title="Portal del pasajero" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Portal del pasajero"
        subtitle="Conversación con los viajeros durante su viaje: avisos enviados y lo que nos cuentan."
        info={<InfoTip>Los pasajeros ingresan con el código de su reserva. Un reclamo se responde aquí y, si corresponde, se registra además en el Libro de Reclamaciones.</InfoTip>}
        actions={
          <Button href="/mobile/pasajero" variant="secondary" icon={<Smartphone size={16} />} iconOnlyOnMobile>
            Ver como pasajero
          </Button>
        }
      />
      <PassengerTiles kpis={overview.kpis} />
      <PassengerWorkspace overview={overview} />
    </>
  );
}
