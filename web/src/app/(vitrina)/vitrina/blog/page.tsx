import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/features/site/StructuredData";
import { Cover, EmptyNote, PostCard } from "@/features/rutas-libres/Cards";
import { formatDate } from "@/lib/format";
import { cityName, readMinutes, rlPath } from "@/lib/rutas-libres";
import { getRlPosts, rlBase, rlOrigin } from "@/lib/server/rutas-libres";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Blog de viajes por el Perú", description: "Guías de free tours, qué comer y cómo moverse en Lima, Cusco, Arequipa y Puno.", alternates: { canonical: `${await rlOrigin()}/blog` } };
}

export default async function BlogPage({ searchParams }: PageProps<"/vitrina/blog">) {
  const { ciudad } = await searchParams;
  const city = typeof ciudad === "string" ? ciudad : undefined;
  const [posts, base, origin] = await Promise.all([getRlPosts(), rlBase(), rlOrigin()]);
  const cities = [...new Set(posts.map((post) => post.city).filter((value): value is string => Boolean(value)))];
  const rows = city ? posts.filter((post) => post.city === city) : posts;
  const [lead, ...rest] = rows;

  return (
    <>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "Blog", name: "Blog de Rutas Libres", url: `${origin}/blog`, blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `${origin}/blog/${post.slug}`, datePublished: post.published_at })) }} />
      <section className="rl-wrap pt-14">
        <span className="rl-kicker">Blog de Rutas Libres</span>
        <h1 className="rl-h1 mt-2 max-w-[20ch] text-[clamp(32px,4.5vw,48px)]">Guías para recorrer el Perú a pie</h1>
        <p className="rl-muted mt-3 max-w-[60ch] text-[17px]">Escritas por guías locales. Cada guía enlaza a los tours de su ciudad.</p>
        {cities.length > 1 && (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            <Link href={rlPath(base, "/blog")} scroll={false} aria-current={!city} className="rl-chip">Todos los destinos</Link>
            {cities.map((value) => <Link key={value} href={rlPath(base, `/blog?ciudad=${value}`)} scroll={false} aria-current={city === value} className="rl-chip">{cityName(value)}</Link>)}
          </div>
        )}
      </section>
      <section className="rl-wrap pt-8">
        {!lead ? (
          <EmptyNote>Aún no hay artículos publicados.</EmptyNote>
        ) : (
          <>
            <Link href={rlPath(base, `/blog/${lead.slug}`)} className="rl-card rl-hover group grid overflow-hidden md:grid-cols-[1.2fr_1fr]">
              <Cover city={lead.city} className="min-h-[220px]"><div className="flex h-full items-start p-5"><span className="rl-tag rl-tag-coral">Lo más reciente</span></div></Cover>
              <div className="flex flex-col gap-3 p-7 sm:p-9">
                <span className="rl-muted text-[13px]">{lead.city ? `${cityName(lead.city)} · ` : ""}{readMinutes(lead.word_count)} min de lectura</span>
                <h2 className="rl-h2 text-[28px] transition-colors group-hover:text-[var(--rl-cobalt)]">{lead.title}</h2>
                <p className="rl-muted text-[15px]">{lead.excerpt}</p>
                <span className="rl-muted mt-auto text-[13px]">{lead.author ?? "Equipo Rutas Libres"}{lead.published_at ? ` · ${formatDate(lead.published_at)}` : ""}</span>
              </div>
            </Link>
            {rest.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rest.map((post, index) => <PostCard key={post.slug} post={post} base={base} index={index} />)}</div>}
          </>
        )}
      </section>
    </>
  );
}
