import { Eye, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { PreviewPicker } from "@/features/channels/ChannelUi";
import { PassengerPhone, PassengerSide } from "@/features/mobile/PassengerApp";
import type { PassengerPreview } from "@/lib/mobile";
import { getResource } from "@/lib/server/resource";

function ReadOnlyNotice() {
  return (
    <p role="status" data-testid="preview-readonly-banner" className="mb-5 flex items-center gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] px-3.5 py-2.5 text-[13px] text-fg-2">
      <Eye size={16} className="flex-none text-accent" />
      <span>
        <b className="font-semibold text-fg">Vista previa de solo lectura.</b> Ves lo mismo que el pasajero con los datos reales de su reserva; desde aquí no se envía ni se cambia nada.
      </span>
    </p>
  );
}

export async function PassengerAppScreen({ code, title, back }: { code: string; title: string; back?: { href: string; label: string } }) {
  const preview = await getResource<PassengerPreview>(`/mobile/passenger${code ? `?reservation=${encodeURIComponent(code)}` : ""}`, "No pudimos cargar la app del pasajero.");

  if (!preview) {
    return <PageHeader title={title} back={back} subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title={title}
        back={back}
        subtitle="El viaje en el bolsillo del pasajero: itinerario día a día, vouchers, avisos y chat con la agencia."
        info={<InfoTip>El pasajero ingresa con el código de su reserva. Las alertas de operaciones le llegan como notificación y debe confirmar que las leyó.</InfoTip>}
        actions={<PreviewPicker label="Reserva" param="reserva" value={preview.trip?.code} options={preview.reservations.map((reservation) => ({ value: reservation.code, label: `${reservation.title}` }))} />}
      />
      <ReadOnlyNotice />
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
