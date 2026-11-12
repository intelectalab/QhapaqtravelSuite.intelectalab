import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { StructuredData, breadcrumbNode, postNode } from "@/features/site/StructuredData";
import { formatDate } from "@/lib/format";
import { getSitePost, getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteOrigin } from "@/lib/server/site-seo";
import { siteHref } from "@/lib/site";
import { DATE_LOCALE, siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/blog/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const post = await getSitePost(agencia, slug);
  return { title: post.seo.title ?? post.title, description: post.seo.description ?? post.excerpt };
}

export default async function BlogPostPage({ params }: PageProps<"/sitio/[agencia]/blog/[slug]">) {
  const { agencia, slug } = await params;
  const [post, base, locale, origin, profile] = await Promise.all([getSitePost(agencia, slug), siteBase(agencia), siteLocale(), siteOrigin(agencia), getSiteProfile(agencia)]);
  const site = siteText(locale);
  const t = site.blog;
  const meta = [post.published_at ? formatDate(post.published_at, "short", DATE_LOCALE[locale]) : null, post.author ? t.by(post.author) : null].filter(Boolean).join(" · ");

  return (
    <>
      <StructuredData
        data={[
          postNode(post, origin, `${origin}/blog/${post.slug}`, profile.agency.name),
          breadcrumbNode([{ name: site.common.home, url: origin || undefined }, { name: t.eyebrow, url: `${origin}/blog` }, { name: post.title }]),
        ]}
      />
      <PageHero eyebrow={t.eyebrow} title={post.title} description={post.excerpt}>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-[12.5px] text-white/70">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.eyebrow, href: siteHref(base, "/blog") }, { label: post.title }]} />
        </div>
      </PageHero>
      <article className="mx-auto max-w-[760px] px-5 pt-12 sm:px-8">
        <p className="mb-6 flex flex-wrap items-center gap-3 text-[13px] text-fg-3">
          {meta}
          <span className="inline-flex items-center gap-1"><Clock size={13} /> {t.minutes(post.minutes)}</span>
        </p>
        <RichText body={post.body.replace(/^##\s.*\n/, "")} />
        <Link href={siteHref(base, "/blog")} className="mt-10 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:underline">
          <ArrowLeft size={15} /> {t.back}
        </Link>
      </article>
      {post.related.length > 0 && (
        <section className="mx-auto mt-14 max-w-[1240px] px-5 sm:px-8">
          <h2 className="mb-5 text-[20px] font-bold tracking-tight text-fg">{t.related}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {post.related.map((item) => (
              <Link key={item.slug} href={siteHref(base, `/blog/${item.slug}`)} className="lift group rounded-2xl border border-line bg-surface p-5 hover:border-[color-mix(in_srgb,var(--brand)_40%,transparent)]">
                <h3 className="text-[16px] font-bold leading-snug text-fg group-hover:text-brand">{item.title}</h3>
                <p className="mt-2 text-[13.5px] text-fg-2">{item.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
