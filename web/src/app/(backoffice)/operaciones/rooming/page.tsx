import { BedDouble, ClipboardCheck, Hotel, Send } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { RoomingBoard, RoomingCreateAction } from "@/features/operations/Rooming";
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
        <TintTile icon={Hotel} tone="t1" label="Rooming lists" value={data.items.length} />
        <TintTile icon={BedDouble} tone="t4" label="Habitaciones" value={rooms} />
        <TintTile icon={ClipboardCheck} tone="warn" label="Por confirmar" value={data.items.filter((item) => ["borrador", "modificada"].includes(item.status)).length} note="Borrador o modificadas" />
        <TintTile icon={Send} tone="ok" label="Enviadas al hotel" value={data.items.filter((item) => item.status === "enviada").length} />
      </section>
      <RoomingBoard data={data} />
    </>
  );
}
