import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { PreviewPicker } from "@/features/channels/ChannelUi";
import { PassengerPhone, PassengerSide } from "@/features/mobile/PassengerApp";
import type { PassengerPreview } from "@/lib/mobile";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "App pasajero" };

export default async function PassengerAppPage({ searchParams }: PageProps<"/mobile/pasajero">) {
  const { reserva } = await searchParams;
  const code = typeof reserva === "string" ? reserva : "";
  const preview = await getResource<PassengerPreview>(`/mobile/passenger${code ? `?reservation=${encodeURIComponent(code)}` : ""}`, "No pudimos cargar la app del pasajero.");

  if (!preview) {
    return <PageHeader title="App pasajero" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="App pasajero"
        subtitle="El viaje en el bolsillo del pasajero: itinerario día a día, vouchers, avisos y chat con la agencia."
        info={<InfoTip>El pasajero ingresa con el código de su reserva. Las alertas de operaciones le llegan como notificación y debe confirmar que las leyó.</InfoTip>}
        actions={<PreviewPicker label="Reserva" param="reserva" value={preview.trip?.code} options={preview.reservations.map((reservation) => ({ value: reservation.code, label: `${reservation.title}` }))} />}
      />
      {preview.trip ? (
        <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <PassengerPhone trip={preview.trip} today={preview.today} />
          <PassengerSide trip={preview.trip} />
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Smartphone size={22} />} title="Sin viajes para mostrar" description="Cuando haya una reserva confirmada, aquí verás lo que recibe el pasajero." />
        </Card>
      )}
    </>
  );
}
