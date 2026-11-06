import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { QuoteBuilderForm } from "@/features/quotes/QuoteBuilderForm";
import { getQuote, getQuoteFormOptions } from "@/lib/server/quotes";

export const metadata: Metadata = { title: "Editar cotización" };

export default async function EditarCotizacionPage({ params }: PageProps<"/cotizaciones/[code]/editar">) {
  const { code } = await params;
  const [quote, options] = await Promise.all([getQuote(code), getQuoteFormOptions()]);
  if (!options) return <NoAccess home="/cotizaciones" />;
  if (quote.status !== "borrador") redirect(`/cotizaciones/${code}`);

  return (
    <>
      <PageHeader back={{ href: `/cotizaciones/${code}`, label: quote.code }} jump={false} title="Editar cotización" subtitle={`${quote.title} · versión ${quote.version} en borrador`} />
      <QuoteBuilderForm options={options} quote={quote} />
    </>
  );
}
