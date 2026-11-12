import { jsonLd } from "@/lib/server/site-seo";
import type { DestinationDetail, PostDetail, ProductDetail, SiteProfile } from "@/lib/site";

type Node = Record<string, unknown>;

export function StructuredData({ data }: { data: Node | Node[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}

export function agencyNode(profile: SiteProfile, origin: string): Node {
  const { agency } = profile;
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${origin}#agencia`,
    name: agency.name,
    legalName: agency.legal_name,
    url: origin || undefined,
    logo: agency.logo ?? undefined,
    telephone: agency.phone ?? undefined,
    email: agency.email ?? undefined,
    taxID: agency.ruc,
    address: agency.address ? { "@type": "PostalAddress", streetAddress: agency.address, addressCountry: "PE" } : undefined,
    department: profile.sedes.length > 1 ? profile.sedes.map((sede) => ({ "@type": "TravelAgency", name: `${agency.name} · ${sede.name}` })) : undefined,
  };
}

export function breadcrumbNode(items: { name: string; url?: string }[]): Node {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

export function faqNode(faqs: { q: string; a: string }[]): Node | null {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
  };
}

export function tripNode(detail: ProductDetail, origin: string, url: string): Node {
  const { product, itinerary, reviews } = detail;
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: product.name,
    description: product.seo.description ?? product.summary ?? undefined,
    url,
    image: product.media.map((item) => item.url),
    touristType: product.category,
    itinerary: itinerary.length > 0 ? { "@type": "ItemList", numberOfItems: itinerary.length, itemListElement: itinerary.map((day, index) => ({ "@type": "ListItem", position: index + 1, name: day.title })) } : undefined,
    provider: { "@id": `${origin}#agencia` },
    offers: product.from
      ? { "@type": "Offer", price: product.from.amount.toFixed(2), priceCurrency: product.from.currency, url, availability: "https://schema.org/InStock", validFrom: product.first_date ?? undefined }
      : undefined,
    aggregateRating: reviews.count > 0 && reviews.average !== null ? { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.count, bestRating: 5 } : undefined,
  };
}

export function destinationNode(detail: DestinationDetail, url: string): Node {
  const { destination } = detail;
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: destination.name,
    description: destination.description ?? destination.tagline ?? undefined,
    url,
    geo: destination.lat !== null && destination.lng !== null ? { "@type": "GeoCoordinates", latitude: destination.lat, longitude: destination.lng } : undefined,
    containedInPlace: destination.region ? { "@type": "Place", name: destination.region } : undefined,
    includesAttraction: detail.products.slice(0, 10).map((product) => ({ "@type": "TouristTrip", name: product.name })),
  };
}

export function postNode(post: PostDetail, origin: string, url: string, agency: string): Node {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo.description ?? post.excerpt,
    url,
    datePublished: post.published_at ?? undefined,
    author: post.author ? { "@type": "Person", name: post.author } : { "@type": "Organization", name: agency },
    publisher: { "@id": `${origin}#agencia` },
    mainEntityOfPage: url,
  };
}
