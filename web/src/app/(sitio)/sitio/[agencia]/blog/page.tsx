import { ArrowRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { formatDate } from "@/lib/format";
import { getSitePosts, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { DATE_LOCALE, siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).blog.title };
}

export default async function BlogPage({ params }: PageProps<"/sitio/[agencia]/blog">) {
  const { agencia } = await params;
  const [posts, base, locale] = await Promise.all([getSitePosts(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.blog;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} description={t.description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.eyebrow }]} />
        </div>
      </PageHero>
      <div className="mx-auto max-w-[1240px] px-5 pt-12 sm:px-8">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-[14px] text-fg-2">{t.empty}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <Link key={post.slug} href={siteHref(base, `/blog/${post.slug}`)} style={{ animationDelay: `${index * 80}ms` }} className="lift group flex animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-2xl border border-line bg-surface p-5 hover:border-[color-mix(in_srgb,var(--brand)_40%,transparent)]">
                <span className="flex items-center gap-2 text-[12px] text-fg-3">
                  {post.published_at && <span>{formatDate(post.published_at, "short", DATE_LOCALE[locale])}</span>}
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {t.minutes(post.minutes)}</span>
                </span>
                <h2 className="text-[18px] font-bold leading-snug tracking-tight text-fg group-hover:text-brand">{post.title}</h2>
                <p className="text-[14px] leading-relaxed text-fg-2">{post.excerpt}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[13px] font-semibold text-brand transition-[gap] group-hover:gap-2.5">
                  {post.author ? t.by(post.author) : t.eyebrow} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
