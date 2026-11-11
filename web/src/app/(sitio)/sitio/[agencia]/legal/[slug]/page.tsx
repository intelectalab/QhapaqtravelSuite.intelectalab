import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/cn";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { formatDate } from "@/lib/format";
import { getSitePage, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { DATE_LOCALE, siteText } from "@/lib/site-i18n";

const LEGAL = ["terminos", "privacidad", "cookies", "cancelacion"] as const;

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/legal/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const page = await getSitePage(agencia, slug);
  return { title: page.seo.title ?? page.title };
}

export default async function LegalPage({ params }: PageProps<"/sitio/[agencia]/legal/[slug]">) {
  const { agencia, slug } = await params;
  const [page, base, locale] = await Promise.all([getSitePage(agencia, slug), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.legal;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={page.title}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.eyebrow }, { label: page.title }]} />
        </div>
      </PageHero>
      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 pt-12 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={t.eyebrow} className="flex gap-2 overflow-x-auto lg:flex-col">
          {LEGAL.map((key) => (
            <Link key={key} href={siteHref(base, `/legal/${key}`)} className={cn("whitespace-nowrap rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition", key === slug ? "bg-brand text-white" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
              {t.links[key]}
            </Link>
          ))}
        </nav>
        <article>
          {page.source === "agency" && (
            <p className="mb-6 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
              <Info size={15} className="mt-0.5 flex-none text-brand" />
              {t.generated}
            </p>
          )}
          {page.updated_at && <p className="mb-6 text-[13px] text-fg-3">{t.updated(formatDate(page.updated_at, "short", DATE_LOCALE[locale]))}</p>}
          <RichText body={page.body} />
        </article>
      </div>
    </>
  );
}
