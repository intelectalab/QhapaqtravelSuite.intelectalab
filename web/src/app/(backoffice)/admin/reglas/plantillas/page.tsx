import type { Metadata } from "next";
import { RuleTemplatesGrid } from "@/features/admin/Rules";
import { getRules } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Plantillas por tipo de negocio" };

export default async function ReglasPlantillasPage() {
  const data = await getRules();
  if (!data) return null;
  return <RuleTemplatesGrid data={data} />;
}
