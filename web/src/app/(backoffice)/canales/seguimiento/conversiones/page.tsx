import type { Metadata } from "next";
import { ConversionsMatrix } from "@/features/tracking/TrackingConversions";
import { getCachedResource } from "@/lib/server/resource";
import type { ConversionMatrix, TrackingOverview } from "@/lib/tracking";
import { saveMapping } from "../actions";

export const metadata: Metadata = { title: "Conversiones" };

export default async function ConversionesPage() {
  const [overview, matrix] = await Promise.all([
    getCachedResource<TrackingOverview>("/marketing/tracking/tags", "No pudimos cargar las etiquetas del sitio."),
    getCachedResource<ConversionMatrix>("/marketing/tracking/conversions", "No pudimos cargar las conversiones."),
  ]);
  if (!overview || !matrix) return null;

  return <ConversionsMatrix matrix={matrix} canManage={overview.can_manage} save={saveMapping} remove={saveMapping} initial={{ message: null, done: false }} />;
}
