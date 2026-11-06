import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { CallToAction, HomeHero, Journey, type HeroStat } from "@/features/software/Blocks";
import { getOverview, getPlansCatalog, hasAgencySession } from "@/features/software/data";
import { Faq } from "@/features/software/Faq";
import { buildFaq } from "@/features/software/faq";
import { ModuleAreas } from "@/features/software/ModuleAreas";
import { PanelPreview } from "@/features/software/PanelPreview";
import { PlansExplorer } from "@/features/software/PlansExplorer";
import { ArrowLink, Section, SectionHead } from "@/features/software/Section";
import { SiteFrame } from "@/features/software/SiteFrame";
import { MODULE_AREAS, MODULE_SCREEN_COUNT, trialDays } from "@/lib/software";

export const metadata: Metadata = {
  title: { absolute: "Qhapaq Travel Suite · Software para agencias de viaje" },
  description: "Gestión integral para agencias de viaje y operadores turísticos del Perú: leads, cotizaciones, reservas, operación y cobranza en un solo sistema.",
};

export default async function Home() {
  const [catalog, overview, signedIn] = await Promise.all([getPlansCatalog(), getOverview(), hasAgencySession()]);
  const days = catalog ? trialDays(catalog.plans) : 0;
  const stats: HeroStat[] = [
    { value: MODULE_SCREEN_COUNT, label: "pantallas en un solo sistema" },
    ...(overview ? [{ value: overview.catalog.rules, label: "reglas de reserva configurables" }] : []),
    ...(days > 0 ? [{ value: days, label: "días de prueba gratuita" }] : []),
  ];

  return (
    <SiteFrame>
      <HomeHero signedIn={signedIn} stats={stats} preview={overview ? <PanelPreview overview={overview} /> : null} />

      <Section tinted>
        <SectionHead eyebrow="Cómo trabaja tu agencia" title="Un solo recorrido, del lead a la cobranza." description="Cada paso hereda la información del anterior. Nadie vuelve a digitar al pasajero, el precio ni la fecha del viaje." />
        <Journey />
      </Section>

      <Section id="modulos">
        <SectionHead
          eyebrow="Módulos"
          title="Todo lo que tu agencia necesita, ordenado por lo que hace."
          description={`${MODULE_SCREEN_COUNT} pantallas agrupadas en seis áreas de trabajo, con permisos por rol para que cada persona vea solo lo suyo.`}
          aside={<ArrowLink href="/software/modulos">Ver todos los módulos</ArrowLink>}
        />
        <ModuleAreas areas={MODULE_AREAS} />
      </Section>

      <Section tinted id="planes">
        <SectionHead align="center" eyebrow="Planes" title="Precios claros, en soles y sin permanencia." description={days > 0 ? `Todos los planes incluyen ${days} días de prueba. Cambia de plan cuando tu agencia crezca.` : undefined} />
        {catalog ? (
          <>
            <PlansExplorer catalog={catalog} compact />
            <div className="mt-10 flex justify-center">
              <ArrowLink href="/software/planes#comparar">Comparar todas las funciones</ArrowLink>
            </div>
          </>
        ) : (
          <EmptyState icon={<CloudOff size={22} />} title="No pudimos cargar los planes" description="Vuelve a intentarlo en unos segundos." />
        )}
      </Section>

      {catalog && (
        <Section>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <SectionHead eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de empezar." description="¿Tienes otra duda? Escríbenos desde la página de contacto y te respondemos en el día." />
            <Faq items={buildFaq(catalog)} />
          </div>
        </Section>
      )}

      <CallToAction days={days} />
    </SiteFrame>
  );
}
