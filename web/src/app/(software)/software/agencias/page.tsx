import { Building2, CloudOff, MapPin, Map as MapIcon, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintTile } from "@/components/ui/Tinted";
import { CallToAction } from "@/features/software/Blocks";
import { getOverview, getPlansCatalog } from "@/features/software/data";
import { Reveal } from "@/features/software/Reveal";
import { PageHero, Section, SectionHead } from "@/features/software/Section";
import { Segments } from "@/features/software/Segments";
import { formatNumber } from "@/lib/format";
import { trialDays } from "@/lib/software";

export const metadata: Metadata = {
  title: "Para qué agencias",
  description: "Qhapaq Travel Suite para agencias minoristas, operadores turísticos, DMC receptivos, agencias corporativas y mayoristas del Perú.",
};

export default async function AgenciasPage() {
  const [overview, catalog] = await Promise.all([getOverview(), getPlansCatalog()]);

  return (
    <>
      <PageHero
        eyebrow="Para qué agencias"
        title="Hecho para cómo se vende turismo en el Perú."
        description="Minoristas, operadores, receptivos, corporativas y mayoristas usan el mismo sistema, cada una con los módulos que su operación necesita."
      >
        {overview && (
          <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TintTile variant="bento" tone="t1" icon={Building2} label="Agencias trabajando" value={formatNumber(overview.agencies.live)} note={`${overview.agencies.active} con suscripción activa`} />
            <TintTile variant="bento" tone="t4" icon={MapPin} label="Ciudades con sedes" value={formatNumber(overview.agencies.cities)} note="Oficinas registradas" />
            <TintTile variant="bento" tone="t3" icon={MapIcon} label="Productos turísticos" value={formatNumber(overview.catalog.products)} note="Tours, paquetes y servicios" />
            <TintTile variant="bento" tone="sun" icon={ShieldCheck} label="Reglas de reserva" value={formatNumber(overview.catalog.rules)} note="Configurables por agencia" />
          </div>
        )}
      </PageHero>
      <Section>
        <SectionHead eyebrow="Casos de uso" title="Elige tu tipo de agencia y mira por dónde empezar." description="Cada tarjeta muestra cuántas agencias de ese tipo ya trabajan con Qhapaq y el plan que suelen elegir." />
        {overview ? (
          <Segments segments={overview.segments} />
        ) : (
          <Reveal>
            <EmptyState icon={<CloudOff size={22} />} title="No pudimos cargar esta sección" description="Vuelve a intentarlo en unos segundos." />
          </Reveal>
        )}
      </Section>
      <CallToAction days={catalog ? trialDays(catalog.plans) : 0} />
    </>
  );
}
