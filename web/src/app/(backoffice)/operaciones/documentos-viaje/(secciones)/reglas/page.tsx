import type { Metadata } from "next";
import { TravelDocsWorkspace } from "@/features/operations/TravelDocSections";
import type { TravelDocList, TravelDocRules } from "@/lib/operations";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reglas y recordatorios de documentos" };

export default async function TravelDocsRulesPage() {
  const [data, rules] = await Promise.all([getCachedResource<TravelDocList>("/ops/travel-docs", "No pudimos cargar los documentos de viaje."), getCachedResource<TravelDocRules>("/settings/travel-docs", "No pudimos cargar las reglas de documentos.")]);
  if (!data) return null;
  return <TravelDocsWorkspace data={data} rules={rules} section="rules" />;
}
