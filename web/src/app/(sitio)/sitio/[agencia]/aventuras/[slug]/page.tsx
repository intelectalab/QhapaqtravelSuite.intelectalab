import { ArrowLeft, ArrowRight, Camera } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ui/RichText";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { formatDate } from "@/lib/format";
import { readSite, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import type { PublicStory } from "@/lib/vitrina";

async function loadStory(agencia: string, slug: string): Promise<PublicStory> {
  const result = await readSite<PublicStory>(agencia, `/stories/${encodeURIComponent(slug)}`);
  if (!result.ok || !result.data) notFound();
  return result.data;
}

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/aventuras/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const story = await loadStory(agencia, slug);
  return { title: story.title, description: story.quote ?? undefined };
}

export default async function StoryPage({ params }: PageProps<"/sitio/[agencia]/aventuras/[slug]">) {
  const { agencia, slug } = await params;
  const [story, base] = await Promise.all([loadStory(agencia, slug), siteBase(agencia)]);

  return (
    <>
      <PageHero eyebrow={story.city ?? "Aventuras"} title={story.title} description={story.quote ? `«${story.quote}»` : undefined}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Aventuras", href: siteHref(base, "/aventuras") }, { label: story.title }]} />
        </div>
      </PageHero>
      <article className="mx-auto max-w-[760px] px-5 pt-12 sm:px-8">
        <p className="mb-6 flex flex-wrap items-center gap-3 text-[13px] text-fg-3">
          <span>{story.traveler ?? "Cliente de la agencia"} · {formatDate(story.published_at, "long")}</span>
          {story.photo_count > 0 && <span className="inline-flex items-center gap-1"><Camera size={13} /> {story.photo_count} fotos</span>}
        </p>
        {story.body && story.body !== story.quote ? <RichText body={story.body} /> : story.quote && <blockquote className="border-l-4 border-brand py-2 pl-4 text-[18px] italic text-fg-2">«{story.quote}»</blockquote>}
        <p className="mt-6 text-[12.5px] text-fg-3">Historia publicada con autorización del cliente.</p>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <Link href={siteHref(base, "/aventuras")} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:underline"><ArrowLeft size={15} /> Todas las aventuras</Link>
          {story.product && (
            <Link href={siteHref(base, `/tours/${story.product.slug}`)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5">
              Ver el viaje: {story.product.name} <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </article>
    </>
  );
}
