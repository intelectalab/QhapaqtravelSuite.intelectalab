import type { Metadata } from "next";
import { CardHeader } from "@/components/ui/Card";
import { TemplateFormAction, TemplatesCatalog } from "@/features/platform/SiteTemplatesAdmin";
import { getTemplatesAdmin } from "@/lib/server/siteTemplatesAdmin";

export const metadata: Metadata = { title: "Plantillas web" };

export default async function PlantillasPage() {
  const overview = await getTemplatesAdmin();

  return (
    <>
      <CardHeader title="Catálogo" subtitle="La plantilla por defecto se asigna a las agencias nuevas que no eligen otra. Retirar no afecta a quienes ya la usan." action={<TemplateFormAction overview={overview} />} />
      <TemplatesCatalog overview={overview} />
    </>
  );
}
