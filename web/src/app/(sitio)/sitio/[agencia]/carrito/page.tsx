import { ArrowRight, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CartLines, CartSummary } from "@/features/site/Cart";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { TrackEvent } from "@/features/site/SiteAnalytics";
import { getSiteCart, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).cart.metaTitle, robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: PageProps<"/sitio/[agencia]/carrito">) {
  const { agencia } = await params;
  const [cart, base, locale] = await Promise.all([getSiteCart(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.cart;
  const blocked = cart.items.some((item) => item.quote === null);

  return (
    <>
      <TrackEvent event="view_cart" params={{ items: cart.items.length }} />
      <PageHero eyebrow={t.eyebrow} title={t.title} description={t.description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.crumb }]} />
        </div>
      </PageHero>
      <div className="mx-auto max-w-[1240px] px-5 pt-10 sm:px-8">
        {cart.items.length === 0 ? (
          <div className="grid place-items-center rounded-card border border-dashed border-line px-6 py-16 text-center">
            <ShoppingBag size={30} className="text-fg-3" />
            <h2 className="mt-3 text-[18px] font-bold text-fg">{t.emptyTitle}</h2>
            <p className="mt-1 max-w-[42ch] text-[14px] text-fg-2">{t.emptyBody}</p>
            <Link href={siteHref(base, "/tours")} className="mt-5 inline-flex h-11 items-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
              {t.browse}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <CartLines cart={cart} />
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <CartSummary
                cart={cart}
                action={
                  <>
                    {blocked ? (
                      <p className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2.5 text-[12.5px] text-bad">{t.blocked}</p>
                    ) : (
                      <Link href={siteHref(base, "/checkout")} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110">
                        {t.checkout}
                        <ArrowRight size={16} />
                      </Link>
                    )}
                    <Link href={siteHref(base, "/tours")} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-control text-[13.5px] font-semibold text-fg-2 transition hover:bg-surface-2">
                      {t.keepExploring}
                    </Link>
                  </>
                }
              />
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
