import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import { StructuredData } from "@/features/site/StructuredData";
import { Cover, TourCard } from "@/features/rutas-libres/Cards";
import { Crumbs } from "@/features/rutas-libres/Shell";
import { formatDate } from "@/lib/format";
import { cityName, readMinutes, rlPath } from "@/lib/rutas-libres";
import { getRlOverview, getRlPost, rlBase, rlOrigin } from "@/lib/server/rutas-libres";

export async function generateMetadata({ params }: PageProps<"/vitrina/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [post, origin] = await Promise.all([getRlPost(slug), rlOrigin()]);
  return { title: post.title, description: post.excerpt, keywords: [post.focus_keyword], alternates: { canonical: `${origin}/blog/${post.slug}` }, openGraph: { title: post.title, description: post.excerpt, type: "article", publishedTime: post.published_at ?? undefined } };
}

export default async function PostPage({ params }: PageProps<"/vitrina/blog/[slug]">) {
  const { slug } = await params;
  const [post, overview, base, origin] = await Promise.all([getRlPost(slug), getRlOverview(), rlBase(), rlOrigin()]);
  const url = `${origin}/blog/${post.slug}`;
  const tours = post.tours ?? [];

  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          url,
          mainEntityOfPage: url,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          keywords: post.focus_keyword,
          wordCount: post.word_count,
          author: { "@type": post.author ? "Person" : "Organization", name: post.author ?? overview.brand.name },
          publisher: { "@type": "Organization", name: overview.brand.name },
        }}
      />
      <div className="rl-wrap mt-6">
        <Cover city={post.city} className="overflow-hidden rounded-[2rem]">
          <div className="mx-auto max-w-[860px] px-6 py-14 sm:py-20">
            <Crumbs items={[{ label: "Inicio", href: rlPath(base) }, { label: "Blog", href: rlPath(base, "/blog") }, { label: post.city ? cityName(post.city) : "Guía" }]} />
            <h1 className="rl-h1 mt-4 text-[clamp(30px,4.5vw,48px)]">{post.title}</h1>
            <p className="mt-4 text-[17px] opacity-90">{post.excerpt}</p>
            <p className="mt-5 text-[13px] opacity-80">{post.author ?? "Equipo Rutas Libres"}{post.published_at ? ` · ${formatDate(post.published_at, "long")}` : ""} · {readMinutes(post.word_count)} min de lectura</p>
          </div>
        </Cover>
      </div>
      <article className="rl-wrap pt-10">
        <div className="rl-prose mx-auto max-w-[760px] text-[17px] leading-[1.75]">
          {post.body ? <RichText body={post.body} /> : <p className="rl-muted">El artículo completo se publica desde el editor del blog. Mientras tanto, estos son los tours que recomienda.</p>}
        </div>
      </article>
      {tours.length > 0 && (
        <section className="rl-wrap pt-14">
          <h2 className="rl-h2 mb-6 text-[26px]">Tours recomendados en este artículo</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{tours.map((tour, index) => <TourCard key={tour.code} listing={tour} base={base} index={index} />)}</div>
        </section>
      )}
      <div className="rl-wrap pt-10"><Link href={rlPath(base, "/blog")} className="rl-ghost -ml-3"><ArrowLeft size={15} />Todas las guías</Link></div>
    </>
  );
}
