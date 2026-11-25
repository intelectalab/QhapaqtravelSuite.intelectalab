import { Check, CloudOff, Rocket, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StructuredData } from "@/features/site/StructuredData";
import { BLOG_BASE, type BlogList } from "@/lib/landing-content";
import { getBlogList, softwareOrigin } from "@/lib/server/landing-content";
import { PageHero } from "../Section";
import { FeaturedPost, PopularList, PostCard } from "./BlogCards";
import { BlogFilters, BlogSearch } from "./BlogFilters";
import { NewsletterForm } from "./NewsletterForm";

export type BlogSearchParams = Promise<{ sitio?: string; q?: string; orden?: string }>;

export async function blogMetadata(searchParams: BlogSearchParams, category?: { slug: string; label: string }): Promise<Metadata> {
  const params = await searchParams;
  const clean = category ? `${BLOG_BASE}/categoria/${category.slug}` : BLOG_BASE;
  const filtered = Boolean(params.sitio || params.q || params.orden);
  return {
    title: category ? `${category.label} · Blog` : "Blog para agencias de viaje",
    description: category ? `Artículos de ${category.label.toLowerCase()} para agencias de viaje y operadores turísticos del Perú.` : "Guías de ventas, SUNAT, operación, SEO e IA para agencias de viaje y operadores turísticos del Perú.",
    alternates: { canonical: `${await softwareOrigin()}${clean}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

function Sidebar({ list }: { list: BlogList }) {
  return (
    <aside className="grid content-start gap-5 lg:sticky lg:top-24">
      <div className="rounded-[20px] border border-line bg-surface p-5">
        <p className="text-[15px] font-bold text-fg">Boletín KipuControl</p>
        <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-fg-2">Cambios de SUNAT, métricas de turismo receptivo y guías de digitalización, una vez al mes.</p>
        <NewsletterForm source="blog" cta="Suscribirme" />
      </div>
      <div className="relative isolate overflow-hidden rounded-[20px] bg-menu p-5 text-white">
        <span aria-hidden className="absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-t3 opacity-40 blur-[80px]" />
        <p className="text-[12px] font-semibold tracking-[0.08em] text-white/55">Software para agencias</p>
        <p className="mt-2 text-[17px] font-bold leading-snug">Ordena ventas, operación y cobros en un solo sistema.</p>
        <ul className="mb-5 mt-3 grid gap-1.5 text-[13px] text-white/75">
          {["14 días de prueba sin tarjeta", "Te acompañamos en la puesta en marcha"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check size={14} className="text-t2" />
              {item}
            </li>
          ))}
        </ul>
        <Button href="/software/suscribirse?ciclo=prueba" variant="primary" icon={<Rocket size={16} />}>
          Empezar prueba
        </Button>
      </div>
      {list.popular.length > 0 && (
        <div className="rounded-[20px] border border-line bg-surface p-3">
          <p className="px-2.5 pb-1 pt-2 text-[13px] font-bold text-fg">Más leídos</p>
          <PopularList cards={list.popular} />
        </div>
      )}
    </aside>
  );
}

export async function BlogIndex({ searchParams, category }: { searchParams: BlogSearchParams; category?: string }) {
  const params = await searchParams;
  const list = await getBlogList({ site: params.sitio, category, q: params.q, order: params.orden });
  const origin = await softwareOrigin();
  const current = list?.categories.find((item) => item.value === category);

  return (
    <>
      <PageHero eyebrow="Blog de KipuControl" title={current ? current.label : "Ideas para vender, operar y cobrar mejor."} description={current ? `Guías de ${current.label.toLowerCase()} escritas por quienes operan agencias en el Perú.` : "Guías prácticas de ventas, SUNAT, operación, SEO e IA para agencias de viaje y operadores turísticos del Perú."}>
        {list && <BlogSearch list={list} />}
      </PageHero>
      <section className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        {!list ? (
          <EmptyState icon={<CloudOff size={22} />} title="No pudimos cargar el blog" description="Vuelve a intentarlo en unos segundos." />
        ) : (
          <>
            {list.featured && (
              <div className="mb-10">
                <FeaturedPost card={list.featured} />
              </div>
            )}
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <BlogFilters list={list} />
                {list.items.length === 0 ? (
                  <div className="mt-8">
                    <EmptyState icon={<SearchX size={22} />} title="No hay artículos con esos filtros" description="Prueba con otra categoría o busca con menos palabras." />
                  </div>
                ) : (
                  <div className="mt-7 grid gap-5 sm:grid-cols-2">
                    {list.items.map((card) => (
                      <PostCard key={card.id} card={card} />
                    ))}
                  </div>
                )}
              </div>
              <Sidebar list={list} />
            </div>
            <StructuredData
              data={{
                "@context": "https://schema.org",
                "@type": "Blog",
                name: "Blog de KipuControl",
                url: `${origin}${BLOG_BASE}`,
                blogPost: list.items
                  .filter((card) => card.site === "kipucontrol")
                  .map((card) => ({ "@type": "BlogPosting", headline: card.title, url: `${origin}${card.href}`, datePublished: card.published_at, author: { "@type": "Person", name: card.author } })),
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
