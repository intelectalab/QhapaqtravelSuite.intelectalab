import type { PlansCatalog } from "@/lib/software";
import type { FaqItem } from "./Faq";

type Node = Record<string, unknown>;

export const SOFTWARE_DESCRIPTION = "Software de gestión para agencias de viaje y operadores turísticos del Perú: leads, cotizaciones, reservas, operación y cobranza en un solo sistema.";

export function organizationNode(origin: string): Node {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}#kipucontrol`,
    name: "KipuControl",
    legalName: "KipuControl Cloud S.A.C.",
    url: origin,
    logo: `${origin}/marca/tocapu.svg`,
    description: SOFTWARE_DESCRIPTION,
    areaServed: "PE",
  };
}

export function softwareNode(origin: string, catalog: PlansCatalog): Node {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "KipuControl",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, iOS",
    url: origin,
    description: SOFTWARE_DESCRIPTION,
    publisher: { "@id": `${origin}#kipucontrol` },
    offers: catalog.plans.map((plan) => ({
      "@type": "Offer",
      name: `Plan ${plan.name}`,
      price: plan.price_month.toFixed(2),
      priceCurrency: plan.currency,
      url: `${origin}/software/planes`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: plan.price_month.toFixed(2), priceCurrency: plan.currency, unitText: "MES", valueAddedTaxIncluded: false },
      ...(plan.trial_days > 0 ? { eligibleDuration: { "@type": "QuantitativeValue", value: plan.trial_days, unitCode: "DAY" } } : {}),
    })),
  };
}

export function faqPageNode(items: FaqItem[]): Node | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
}

export function softwareNodes(origin: string, catalog: PlansCatalog | null, faq: FaqItem[]): Node[] {
  return [organizationNode(origin), ...(catalog ? [softwareNode(origin, catalog)] : []), ...[faqPageNode(faq)].filter((node): node is Node => node !== null)];
}
