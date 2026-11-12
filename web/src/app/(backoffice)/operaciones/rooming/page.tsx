import { BedDouble, ClipboardCheck, Hotel, Send } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { RoomingBoard, RoomingCreateAction, RoomingPrefillNotice } from "@/features/operations/Rooming";
import type { RoomingOverview } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Rooming list" };

export default async function RoomingPage() {
  const data = await getResource<RoomingOverview>("/ops/rooming-lists", "No pudimos cargar las rooming lists.");

  if (!data) {
    return <PageHeader title="Rooming list" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const rooms = data.items.reduce((sum, item) => sum + item.rooms.length, 0);

  return (
    <>
      <PageHeader
        title="Rooming list"
        subtitle="Quién duerme en cada habitación, lista por lista y hotel por hotel."
        info={<InfoTip>Un pasajero no puede ocupar dos habitaciones en fechas que se cruzan, y una habitación no se asigna a dos reservas a la vez en el mismo hotel.</InfoTip>}
        actions={data.can.modify && data.candidates.length > 0 ? <RoomingCreateAction candidates={data.candidates} hotels={data.hotels} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hotel} tone="t1" label="Rooming lists" value={data.items.length} note={`${rooms} habitaciones`} info="Listas de habitaciones vigentes de todas las reservas, una por hotel o ciudad." />
        <TintTile icon={ClipboardCheck} tone="warn" label="Por confirmar" value={data.items.filter((item) => ["borrador", "modificada"].includes(item.status)).length} note="Borrador o modificadas" info="Listas en borrador o modificadas después de enviarse: hay que confirmarlas y enviarlas otra vez al hotel." />
        <TintTile icon={Send} tone="info" label="Sin acuse del hotel" value={data.items.filter((item) => item.sent_at && !item.hotel_ack_at && !item.hotel_confirmed_at).length} note={`${data.items.filter((item) => item.hotel_ack_at && !item.hotel_confirmed_at).length} recibidas, sin confirmar`} info="Listas enviadas cuyo hotel todavía no acusó recibo desde la extranet. La nota cuenta las que ya recibió pero aún no confirma." />
        <TintTile icon={BedDouble} tone="bad" label="Habitaciones observadas" value={data.items.reduce((sum, item) => sum + item.rooms.filter((room) => room.status === "observada").length, 0)} note="Reportadas por el hotel" info="Habitaciones que el hotel observó desde la extranet; cada una abre una incidencia para Operaciones." />
      </section>
      <RoomingPrefillNotice items={data.prefill} canModify={data.can.modify} />
      <RoomingBoard data={data} />
    </>
  );
}
