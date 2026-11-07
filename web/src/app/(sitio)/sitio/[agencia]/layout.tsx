import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { SiteBanner } from "@/features/site/SiteBanner";
import { SiteProvider } from "@/features/site/SiteContext";
import { SiteFooter } from "@/features/site/SiteFooter";
import { SiteHeader } from "@/features/site/SiteHeader";
import { getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: LayoutProps<"/sitio/[agencia]">): Promise<Metadata> {
  const { agencia } = await params;
  const [profile, locale] = await Promise.all([getSiteProfile(agencia), siteLocale()]);
  const t = siteText(locale);
  return {
    title: { absolute: t.meta.title(profile.agency.name), template: `%s · ${profile.agency.name}` },
    description: t.meta.description(profile.agency.legal_name),
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [profile, base, locale] = await Promise.all([getSiteProfile(agencia), siteBase(agencia), siteLocale()]);
  const style = { "--brand": profile.branding.brand, "--site-accent": profile.branding.accent, "--menu": profile.branding.menu, "--t1": profile.branding.accent } as CSSProperties;

  return (
    <SiteProvider value={{ agencia, base, name: profile.agency.name, locale }}>
      <div lang={locale} style={style} className="flex min-h-screen flex-col bg-bg text-fg [--accent:var(--site-accent)] dark:[--accent:color-mix(in_srgb,var(--t1)_45%,#b9c2ff)]">
        {profile.banner && <SiteBanner title={profile.banner.title} body={profile.banner.body} />}
        <SiteHeader name={profile.agency.name} initials={profile.agency.initials} logo={profile.agency.logo} />
        <main className="flex-1">{children}</main>
        <SiteFooter profile={profile} base={base} />
      </div>
    </SiteProvider>
  );
}
