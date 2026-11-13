import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { CallToAction } from "@/features/software/Blocks";
import { getDemoOptions, getPlansCatalog } from "@/features/software/data";
import { SalesLeadForm } from "@/features/software/SalesLeadForm";
import { SubscriptionPerks } from "@/features/software/SubscriptionPerks";
import { Faq } from "@/features/software/Faq";
import { buildFaq } from "@/features/software/faq";
import { PlansExplorer } from "@/features/software/PlansExplorer";
import { PageHero, Section, SectionHead } from "@/features/software/Section";
import { formatMoney } from "@/lib/format";
import { trialDays } from "@/lib/software";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Planes de KipuControl para agencias de viaje: precios mensuales y anuales en soles, límites, funciones y adicionales.",
};

export default async function PlanesPage({ searchParams }: PageProps<"/software/planes">) {
  const [{ ciclo }, catalog, options] = await Promise.all([searchParams, getPlansCatalog(), getDemoOptions()]);
  const days = catalog ? trialDays(catalog.plans) : 0;
  const entry = catalog?.plans[0];

  return (
    <>
      <PageHero
        eyebrow="Planes y precios"
        title="Un plan para cada etapa de tu agencia."
        description={
          entry
            ? `Desde ${formatMoney(entry.price_month, entry.currency)} al mes. Precios en soles, ${days} días de prueba y sin permanencia: sube de plan cuando tu operación lo pida.`
            : "Precios en soles, prueba gratuita y sin permanencia."
        }
      />
      <Section className="pt-12 sm:pt-16">
        {catalog ? (
          <PlansExplorer catalog={catalog} initialCycle={ciclo === "anual" ? "year" : "month"} withMatrix />
        ) : (
          <EmptyState icon={<CloudOff size={22} />} title="No pudimos cargar los planes" description="Vuelve a intentarlo en unos segundos." />
        )}
      </Section>
      <Section>
        <SubscriptionPerks days={days} />
      </Section>
      {options && (
        <Section id="ventas" tinted>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <SectionHead eyebrow="Enterprise y propuestas" title="Hablemos de tu operación." description="Varias sedes, mayoristas o integraciones a medida: te preparamos una propuesta con el equipo comercial." />
            <div className="lift rounded-[24px] border border-line bg-surface p-5 shadow-card sm:p-7">
              <SalesLeadForm options={options} plan={catalog?.plans.find((plan) => plan.rank >= 3)?.code} />
            </div>
          </div>
        </Section>
      )}
      {catalog && (
        <Section>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <SectionHead eyebrow="Antes de elegir" title="Dudas frecuentes sobre planes y pagos." />
            <Faq items={buildFaq(catalog).slice(0, 6)} />
          </div>
        </Section>
      )}
      <div className="pt-16 sm:pt-24">
        <CallToAction days={days} title="¿No sabes qué plan elegir?" description="Cuéntanos cuántas personas venden y operan en tu agencia y te recomendamos el plan que se ajusta a tu volumen." />
      </div>
    </>
  );
}
