import type { Metadata } from "next";
import { ConversionsMatrix } from "@/features/tracking/TrackingConversions";
import { TagsTable } from "@/features/tracking/TrackingTags";
import { platformGet } from "@/lib/server/platform";
import type { PlatformTracking } from "@/lib/tracking";
import { createPlatformTag, platformTagAction, savePlatformMapping, updatePlatformTag } from "../actions";

export const metadata: Metadata = { title: "Etiquetas de la vitrina" };

export default async function EtiquetasVitrinaPage() {
  const data = await platformGet<PlatformTracking>("/tracking/tags");
  const initial = { message: null, done: false };

  return (
    <div className="flex flex-col gap-6">
      <TagsTable screen="vitrina-etiquetas" rows={data.rows} providers={data.providers} canManage canApprove me={data.me} selfApprovalBlocked platform actions={{ create: createPlatformTag, update: updatePlatformTag, act: platformTagAction, initial }} />
      <section>
        <h3 className="mb-1 text-[14.5px] font-semibold">Conversiones de captación</h3>
        <p className="mb-3 text-[12.5px] text-fg-3">El registro de agencia y el plan pagado se envían desde el servidor para optimizar las campañas.</p>
        <ConversionsMatrix matrix={data.conversions} canManage save={savePlatformMapping} initial={initial} />
      </section>
    </div>
  );
}
