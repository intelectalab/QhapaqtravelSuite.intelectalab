import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { AiCreditTiles } from "@/features/channels/AiContent";
import { getAiCredits, getAiImages, getAiJobs } from "@/lib/server/aiContent";

export default async function AiContentLayout({ children }: { children: ReactNode }) {
  const [summary, jobs, images] = await Promise.all([getAiCredits(), getAiJobs(), getAiImages()]);

  if (!summary || !jobs || !images) {
    return <PageHeader title="Contenido con IA" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Contenido con IA"
        subtitle="Mejore descripciones, títulos SEO, traducciones, relatos y artículos, y cree imágenes para su sitio."
        info={<InfoTip>Nada se publica sin que una persona lo revise y lo aplique. Cada pedido muestra su costo antes de generar; si la IA falla, no se cobra.</InfoTip>}
      />
      <AiCreditTiles summary={summary} jobs={jobs.items} />
      <TabbedCard
        tabs={[
          { href: "/canales/contenido-ia", label: "Mejorar contenido", count: jobs.items.filter((job) => job.status === "listo" && job.kind !== "imagen").length },
          { href: "/canales/contenido-ia/imagenes", label: "Imágenes", count: images.filter((image) => image.status !== "descartada").length },
          { href: "/canales/contenido-ia/historial", label: "Historial", count: jobs.items.length },
          { href: "/canales/contenido-ia/planes", label: "Planes y créditos" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
