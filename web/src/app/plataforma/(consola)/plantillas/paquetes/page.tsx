import type { Metadata } from "next";
import { CardHeader } from "@/components/ui/Card";
import { AiPacksTable } from "@/features/platform/SiteTemplatesAdmin";
import { getPlatformAiPacks } from "@/lib/server/siteTemplatesAdmin";

export const metadata: Metadata = { title: "Paquetes de IA" };

export default async function PaquetesPage() {
  const packs = await getPlatformAiPacks();

  return (
    <>
      <CardHeader title="Paquetes y planes de IA" subtitle="Créditos de contenido e imágenes que las agencias compran o contratan desde Contenido con IA." />
      <AiPacksTable packs={packs} />
    </>
  );
}
