import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { StructuredData } from "@/features/site/StructuredData";
import { Footer, Header } from "@/features/rutas-libres/Shell";
import { getRlOverview, rlBase, rlOrigin } from "@/lib/server/rutas-libres";
import "./rutas-libres.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-rutas", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const [overview, origin] = await Promise.all([getRlOverview(), rlOrigin()]);
  return {
    title: { absolute: `Free tours en Perú con guías locales · ${overview.brand.name}`, template: `%s · ${overview.brand.name}` },
    description: "Reserve gratis free walking tours en Lima, Cusco, Arequipa y Puno. Agencias verificadas, guías oficiales y reseñas de asistentes.",
    metadataBase: new URL(origin.endsWith("/") ? origin : `${origin}/`),
    openGraph: { siteName: overview.brand.name, locale: "es_PE", type: "website" },
  };
}

export default async function RutasLibresLayout({ children }: LayoutProps<"/vitrina">) {
  const [overview, base, origin] = await Promise.all([getRlOverview(), rlBase(), rlOrigin()]);
  return (
    <div data-rutas lang="es" className={`${jakarta.variable} flex min-h-screen flex-col`}>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "WebSite", name: overview.brand.name, url: origin }} />
      <Header base={base} overview={overview} />
      <main className="flex-1">{children}</main>
      <Footer base={base} overview={overview} />
    </div>
  );
}
