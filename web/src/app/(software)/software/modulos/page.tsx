import type { Metadata } from "next";
import { CallToAction, Journey } from "@/features/software/Blocks";
import { getPlansCatalog } from "@/features/software/data";
import { FeatureAvailability } from "@/features/software/FeatureAvailability";
import { ModuleAreas } from "@/features/software/ModuleAreas";
import { ArrowLink, PageHero, Section, SectionHead } from "@/features/software/Section";
import { NAV_GROUPS } from "@/config/navigation";
import { MODULE_AREAS, MODULE_SCREEN_COUNT, trialDays } from "@/lib/software";

export const metadata: Metadata = {
  title: "Módulos",
  description: "CRM, catálogo turístico, cotizaciones, reservas, operaciones, finanzas, canales y administración: los módulos de Qhapaq Travel Suite.",
};

export default async function ModulosPage() {
  const catalog = await getPlansCatalog();

  return (
    <>
      <PageHero
        eyebrow="Módulos"
        title="Todo tu negocio turístico en un mismo sistema."
        description={`${NAV_GROUPS.length} módulos y ${MODULE_SCREEN_COUNT} pantallas conectadas entre sí: lo que vende tu equipo comercial llega listo a operaciones y a finanzas.`}
      />
      <Section>
        <ModuleAreas areas={MODULE_AREAS} detailed />
      </Section>
      <Section tinted>
        <SectionHead eyebrow="Cómo se conectan" title="La información avanza sola de un módulo al siguiente." />
        <Journey />
      </Section>
      {catalog && (
        <Section>
          <SectionHead eyebrow="Disponibilidad" title="Qué plan incluye cada función." description="Los planes superiores incluyen todo lo del anterior. Algunas funciones se pueden sumar como adicional." aside={<ArrowLink href="/software/planes#comparar">Ver la comparación completa</ArrowLink>} />
          <FeatureAvailability catalog={catalog} />
        </Section>
      )}
      <CallToAction days={catalog ? trialDays(catalog.plans) : 0} />
    </>
  );
}
