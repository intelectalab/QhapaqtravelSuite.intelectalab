import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { QuoteBuilderForm } from "@/features/quotes/QuoteBuilderForm";
import { getQuoteFormOptions } from "@/lib/server/quotes";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function NuevaCotizacionPage({ searchParams }: PageProps<"/cotizaciones/nueva">) {
  const { oportunidad } = await searchParams;
  const options = await getQuoteFormOptions();
  if (!options) return <NoAccess home="/cotizaciones" />;

  return (
    <>
      <PageHeader back={{ href: "/cotizaciones", label: "Cotizaciones" }} jump={false} title="Nueva cotización" subtitle="Se guarda como borrador en su versión 1. El precio lo calcula el sistema con las tarifas vigentes." />
      <QuoteBuilderForm options={options} opportunityCode={typeof oportunidad === "string" ? oportunidad : undefined} />
    </>
  );
}
