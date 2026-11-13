import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDemoOptions, getLandingCatalog } from "@/features/software/data";
import { Eyebrow } from "@/features/software/Section";
import { SignupWizard } from "@/features/software/SignupWizard";
import type { SignupCycle } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Suscribirse",
  description: "Crea la cuenta de tu agencia en KipuControl en tres pasos: plan, datos de la empresa y pago. Prueba de 14 días sin tarjeta.",
};

const CYCLES: SignupCycle[] = ["mensual", "anual", "prueba"];

export default async function SuscribirsePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, catalog, options] = await Promise.all([searchParams, getLandingCatalog(), getDemoOptions()]);
  const cycle = CYCLES.includes(params.ciclo as SignupCycle) ? (params.ciclo as SignupCycle) : "prueba";
  const attribution = Object.fromEntries(Object.entries({ utm_source: params.utm_source, utm_medium: params.utm_medium, utm_campaign: params.utm_campaign, gclid: params.gclid, fbclid: params.fbclid }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));

  return (
    <section className="relative isolate overflow-hidden">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        <Eyebrow>Suscripción</Eyebrow>
        <h1 className="site-display mt-4 text-[32px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[44px]">Activa KipuControl para tu agencia.</h1>
        <p className="mb-10 mt-3 max-w-2xl text-[15.5px] text-fg-2">Tres pasos y tu equipo empieza hoy. Los precios no incluyen IGV; el resumen lo calcula antes de pagar.</p>
        {catalog && options ? (
          <SignupWizard catalog={catalog} businessTypes={options.business_types} initialPlan={params.plan} initialCycle={cycle} attribution={attribution} />
        ) : (
          <EmptyState icon={<CloudOff size={22} />} title="La suscripción no está disponible" description="Vuelve a intentarlo en unos segundos." />
        )}
      </div>
    </section>
  );
}
