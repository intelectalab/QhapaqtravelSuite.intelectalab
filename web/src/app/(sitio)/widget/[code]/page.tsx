import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { SiteProvider } from "@/features/site/SiteContext";
import { WidgetBooking, WidgetFrame } from "@/features/site/WidgetBooking";
import { WidgetCatalog } from "@/features/site/WidgetCatalog";
import { WidgetReviews } from "@/features/site/WidgetReviews";
import { getSiteProduct, getSiteProfile } from "@/lib/server/site";
import { getReviewWidget, getWidgetConfig } from "@/lib/server/widget";
import { siteThemeStyle } from "@/lib/site-design";
import { SITE_FONT_VARIABLES } from "@/lib/site-fonts";
import { parseSiteLocale, siteText } from "@/lib/site-i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function param(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
}

export default async function WidgetPage({ params, searchParams }: PageProps<"/widget/[code]">) {
  const [{ code }, search] = await Promise.all([params, searchParams]);
  const key = param(search.key);
  const catalog = code === "catalogo";
  const reviewsOnly = code === "resenas";
  const config = await getWidgetConfig(key, catalog || reviewsOnly ? null : decodeURIComponent(code));
  const locale = parseSiteLocale(param(search.lang) ?? config?.defaults.lang);

  if (!config) {
    const t = siteText(locale);
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-6 text-center text-fg">
        <div className="max-w-[420px]">
          <h1 className="text-[18px] font-semibold">{t.widget.unavailableTitle}</h1>
          <p className="mt-2 text-[13.5px] text-fg-2">{t.widget.unavailableBody}</p>
        </div>
      </main>
    );
  }

  const agencia = config.agency.subdomain;
  const profile = await getSiteProfile(agencia);
  const themeParam = param(search.theme);
  const theme = themeParam && /^#?[0-9A-Fa-f]{6}$/.test(themeParam) ? `#${themeParam.replace("#", "")}` : config.defaults.theme;
  const radius = Math.max(0, Math.min(24, Number(param(search.radius) ?? config.defaults.radius) || 0));
  const currency = param(search.currency) === "USD" || param(search.currency) === "PEN" ? (param(search.currency) as string) : config.defaults.currency;
  const reviewsParam = param(search.reviews);
  const reviews = reviewsParam === undefined ? config.defaults.reviews : ["1", "true", "si", "yes"].includes(reviewsParam);
  const style = { ...siteThemeStyle({ ...profile.branding, brand: theme, accent: theme, font: profile.design.theme.font, corners: profile.design.theme.corners }), "--radius-card": `${radius + 6}px`, "--radius-tile": `${radius + 4}px`, "--radius-control": `${radius}px` } as CSSProperties;
  const query = `?${new URLSearchParams(Object.entries({ key, lang: locale, currency, theme: theme.slice(1), radius: String(radius), reviews: reviews ? "1" : "0" }).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`;
  const detail = config.product && !reviewsOnly ? await getSiteProduct(agencia, config.product.slug) : null;
  const feed = reviewsOnly ? await getReviewWidget(key, { sources: param(search.sources), min_rating: param(search["min-rating"]) ?? param(search.min_rating), count: param(search.count), layout: param(search.layout) }) : null;
  const category = param(search.category);

  return (
    <SiteProvider value={{ agencia, base: config.site_url, name: profile.agency.name, locale, design: profile.design }}>
      <div lang={locale} style={style} className={`${SITE_FONT_VARIABLES} min-h-screen bg-bg text-fg [--accent:var(--site-accent)]`}>
        <WidgetFrame verified={config.domains}>
          {feed ? <WidgetReviews feed={feed} /> : detail ? <WidgetBooking config={config} detail={detail} widgetKey={key} currency={currency} reviews={reviews} /> : <WidgetCatalog config={category ? { ...config, products: config.products.filter((item) => item.category === category) } : config} query={query} />}
        </WidgetFrame>
      </div>
    </SiteProvider>
  );
}
