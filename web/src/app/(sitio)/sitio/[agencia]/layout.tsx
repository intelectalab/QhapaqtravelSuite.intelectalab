import type { Metadata } from "next";
import { PreviewBridge } from "@/features/site/PreviewBridge";
import { SiteBanner } from "@/features/site/SiteBanner";
import { SiteProvider } from "@/features/site/SiteContext";
import { SiteFooter } from "@/features/site/SiteFooter";
import { SiteHeader } from "@/features/site/SiteHeader";
import { getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteThemeStyle } from "@/lib/site-design";
import { SITE_FONT_VARIABLES } from "@/lib/site-fonts";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: LayoutProps<"/sitio/[agencia]">): Promise<Metadata> {
  const { agencia } = await params;
  const [profile, locale] = await Promise.all([getSiteProfile(agencia), siteLocale()]);
  const t = siteText(locale);
  const seo = profile.design.seo;
  return {
    title: { absolute: seo.title || t.meta.title(profile.agency.name), template: `%s · ${profile.agency.name}` },
    description: seo.description || t.meta.description(profile.agency.legal_name),
    ...(profile.preview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [profile, base, locale] = await Promise.all([getSiteProfile(agencia), siteBase(agencia), siteLocale()]);
  const { design } = profile;
  const style = siteThemeStyle({ ...profile.branding, font: design.theme.font, corners: design.theme.corners });

  return (
    <SiteProvider value={{ agencia, base, name: profile.agency.name, locale, design }}>
      <div id="site-root" lang={locale} style={style} className={`${SITE_FONT_VARIABLES} flex min-h-screen flex-col bg-bg text-fg [--accent:var(--site-accent)] dark:[--accent:color-mix(in_srgb,var(--t1)_45%,#b9c2ff)]`}>
        {profile.preview && <PreviewBridge agencia={agencia} />}
        {profile.banner && <SiteBanner banner={profile.banner} base={base} />}
        <SiteHeader name={profile.agency.name} initials={profile.agency.initials} logo={profile.agency.logo} />
        <main className="flex-1">{children}</main>
        <SiteFooter profile={profile} base={base} />
      </div>
    </SiteProvider>
  );
}
