import { ArrowRight, Camera, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { formatDate } from "@/lib/format";
import { readSite, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import type { PublicStory } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Aventuras de nuestros viajeros", description: "Historias reales de clientes que viajaron con nosotros, publicadas con su autorización." };

export default async function StoriesPage({ params }: PageProps<"/sitio/[agencia]/aventuras">) {
  const { agencia } = await params;
  const [result, base] = await Promise.all([readSite<PublicStory[]>(agencia, "/stories"), siteBase(agencia)]);
  const stories = result.ok && result.data ? result.data : [];

  return (
    <>
      <PageHero eyebrow="Aventuras" title="Aventuras de nuestros viajeros" description="Historias reales, publicadas con la autorización de cada cliente.">
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Aventuras" }]} />
        </div>
      </PageHero>
      <div className="mx-auto max-w-[1240px] px-5 pt-12 sm:px-8">
        {stories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-[14px] text-fg-2">Aún no hay historias publicadas.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {stories.map((story, index) => (
              <Link key={story.slug} href={siteHref(base, `/aventuras/${story.slug}`)} style={{ animationDelay: `${index * 80}ms` }} className="lift group flex animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-2xl border border-line bg-surface p-5 hover:border-[color-mix(in_srgb,var(--brand)_40%,transparent)]">
                <span className="flex flex-wrap items-center gap-3 text-[12px] text-fg-3">
                  {story.city && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {story.city}</span>}
                  <span>{formatDate(story.published_at)}</span>
                  {story.photo_count > 0 && <span className="inline-flex items-center gap-1"><Camera size={12} /> {story.photo_count}</span>}
                </span>
                <h2 className="text-[18px] font-bold leading-snug tracking-tight text-fg group-hover:text-brand">{story.title}</h2>
                {story.quote && <p className="text-[14px] italic leading-relaxed text-fg-2">«{story.quote}»</p>}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[13px] font-semibold text-brand transition-[gap] group-hover:gap-2.5">
                  {story.traveler ?? "Cliente de la agencia"} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
