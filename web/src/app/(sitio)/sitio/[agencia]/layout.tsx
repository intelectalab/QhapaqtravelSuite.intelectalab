import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteChat } from "@/features/site/Chat";
import { PreviewBridge } from "@/features/site/PreviewBridge";
import { SiteAnalytics } from "@/features/site/SiteAnalytics";
import { SiteBanner } from "@/features/site/SiteBanner";
import { SiteProvider } from "@/features/site/SiteContext";
import { SiteFooter } from "@/features/site/SiteFooter";
import { SiteHeader, SiteTopBar } from "@/features/site/SiteHeader";
import { StructuredData, agencyNode } from "@/features/site/StructuredData";
import { TemplatePreviewBar } from "@/features/site/TemplatePreviewBar";
import { REALMS } from "@/lib/realms";
import { accountFetch, accountToken, getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteOrigin } from "@/lib/server/site-seo";
import { andesStyle, siteThemeStyle } from "@/lib/site-design";
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
    ...(profile.preview || profile.templatePreview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [profile, base, locale, origin, store, wish] = await Promise.all([getSiteProfile(agencia), siteBase(agencia), siteLocale(), siteOrigin(agencia), cookies(), accountToken(agencia).then((token) => (token ? accountFetch<{ items: unknown[] }>(agencia, "/me/wishlist") : null))]);
  const wishlist = wish?.ok && wish.data ? wish.data.items.length : null;
  const { design } = profile;
  const andes = design.theme.style === "andes";
  const style = { ...siteThemeStyle({ ...profile.branding, font: design.theme.font, corners: design.theme.corners }), ...(andes ? andesStyle(design.andes) : {}) };

  return (
    <SiteProvider value={{ agencia, base, name: profile.agency.name, locale, design }}>
      <div id="site-root" lang={locale} data-site-style={design.theme.style ?? "actual"} data-andes-serif={andes && design.andes?.serif_titles === false ? "off" : undefined} style={style} className={`${SITE_FONT_VARIABLES} flex min-h-screen flex-col bg-bg text-fg [--accent:var(--site-accent)] dark:[--accent:color-mix(in_srgb,var(--t1)_45%,#b9c2ff)]`}>
        <StructuredData data={agencyNode(profile, origin)} />
        {profile.preview && <PreviewBridge agencia={agencia} />}
        {profile.banner && <SiteBanner banner={profile.banner} base={base} />}
        <SiteTopBar email={profile.agency.email} whatsapp={design.footer.social.whatsapp || null} />
        <SiteHeader name={profile.agency.name} initials={profile.agency.initials} logo={profile.agency.logo} wishlist={wishlist} />
        <main className="flex-1">{children}</main>
        <SiteFooter profile={profile} base={base} />
        {!profile.preview && !profile.templatePreview && <SiteAnalytics />}
        {!profile.preview && !profile.templatePreview && <SiteChat />}
        {profile.templatePreview && <TemplatePreviewBar agencia={agencia} preview={profile.templatePreview} canManage={store.has(REALMS.agency.session)} />}
      </div>
    </SiteProvider>
  );
}
