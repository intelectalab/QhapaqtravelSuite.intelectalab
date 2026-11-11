import { Building2, Compass, Map, MapPin, Phone, Star, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteAbout, getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/nosotros">): Promise<Metadata> {
  const { agencia } = await params;
  const [profile, locale] = await Promise.all([getSiteProfile(agencia), siteLocale()]);
  return { title: siteText(locale).about.title(profile.agency.name) };
}

export default async function AboutPage({ params }: PageProps<"/sitio/[agencia]/nosotros">) {
  const { agencia } = await params;
  const [about, profile, base, locale] = await Promise.all([getSiteAbout(agencia), getSiteProfile(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.about;
  const stats = [
    { icon: Compass, label: t.products, value: String(about.stats.products) },
    { icon: Map, label: t.destinations, value: String(about.stats.destinations) },
    { icon: Ticket, label: t.trips, value: String(about.stats.trips) },
    ...(about.stats.rating ? [{ icon: Star, label: t.rating, value: `${about.stats.rating.avg.toFixed(1)} / 5` }] : []),
  ];

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title(profile.agency.name)} description={t.description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.eyebrow }]} />
        </div>
      </PageHero>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-14 px-5 pt-12 sm:px-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} style={{ animationDelay: `${index * 80}ms` }} className="lift flex animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
              <stat.icon size={20} className="text-brand" />
              <span className="text-[30px] font-bold leading-none tracking-tight text-fg">{stat.value}</span>
              <span className="text-[13px] text-fg-2">{stat.label}</span>
            </div>
          ))}
        </section>
        {about.body && (
          <section className="max-w-[760px]">
            <RichText body={about.body} />
          </section>
        )}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <h2 className="mb-4 text-[20px] font-bold tracking-tight text-fg">{t.offices}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.sedes.map((sede) => (
                <div key={sede.id} className="lift rounded-2xl border border-line bg-surface p-5">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-fg"><MapPin size={16} className="text-brand" />{sede.name}</p>
                  {sede.address && <p className="mt-1.5 text-[13.5px] text-fg-2">{sede.address}</p>}
                  {sede.phone && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-3"><Phone size={13} />{sede.phone}</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-fg"><Building2 size={17} className="text-brand" />{t.company}</h2>
            <dl className="grid gap-2 text-[13.5px]">
              <div><dt className="text-fg-3">{profile.agency.legal_name}</dt><dd className="font-semibold text-fg">RUC {profile.agency.ruc}</dd></div>
              {profile.agency.registry && <div><dd className="text-fg-2">{profile.agency.registry}</dd></div>}
              {profile.agency.address && <div><dd className="text-fg-2">{profile.agency.address}</dd></div>}
            </dl>
            <Link href={siteHref(base, "/contacto")} className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-110">{t.contact}</Link>
          </div>
        </section>
      </div>
    </>
  );
}
