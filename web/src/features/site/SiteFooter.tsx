"use client";

import { BookOpenText, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { siteHref, type SiteProfile } from "@/lib/site";
import { useSite } from "./SiteContext";
import { AgencyMark } from "./SiteHeader";

const EXPLORE = [
  { path: "/destinos", key: "destinations" },
  { path: "/tours?tipo=tours", key: "tours" },
  { path: "/tours?tipo=paquetes", key: "packages" },
  { path: "/tours?tipo=experiencias", key: "experiences" },
  { path: "/buscar", key: "search" },
] as const;

const HELP = [
  { path: "/viajes-a-medida", key: "tailored" },
  { path: "/contacto", key: "contact" },
  { path: "/libro-reclamaciones", key: "claims" },
] as const;

export function SiteFooter({ profile, base }: { profile: SiteProfile; base: string }) {
  const { agency, sedes, fx } = profile;
  const { t, dateLocale } = useSite();
  return (
    <footer className="relative mt-20 overflow-hidden bg-menu text-white">
      <div className="weave-band h-2" />
      <div aria-hidden className="weave-tint pointer-events-none absolute inset-0 bg-white opacity-[0.04] [mask-size:36px_36px]" />
      <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
        <div>
          <AgencyMark name={agency.name} initials={agency.initials} logo={agency.logo} inverted />
          <p className="mt-4 max-w-[34ch] text-[13.5px] leading-relaxed text-white/65">{t.footer.about}</p>
          <Link href={siteHref(base, "/libro-reclamaciones")} className="group mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10">
            <BookOpenText size={22} className="text-t2 transition-transform group-hover:-rotate-6" />
            <span className="leading-tight">
              <b className="block text-[13.5px]">{t.footer.claimsBook}</b>
              <span className="text-[11.5px] text-white/60">{t.footer.claimsNote}</span>
            </span>
          </Link>
        </div>
        <FooterLinks title={t.footer.explore} base={base} links={EXPLORE.map((link) => ({ path: link.path, label: t.footer.exploreLinks[link.key] }))} />
        <FooterLinks title={t.footer.help} base={base} links={HELP.map((link) => ({ path: link.path, label: t.footer.helpLinks[link.key] }))} />
        <div>
          <h2 className="text-[13px] font-semibold text-white/90">{t.footer.contactTitle}</h2>
          <ul className="mt-4 grid gap-3 text-[13px] text-white/70">
            {agency.phone && (
              <li className="flex items-center gap-2.5">
                <Phone size={15} className="flex-none text-t2" />
                <span className="select-all">{agency.phone}</span>
              </li>
            )}
            {agency.email && (
              <li className="flex items-center gap-2.5">
                <Mail size={15} className="flex-none text-t2" />
                <a href={`mailto:${agency.email}`} className="break-all transition hover:text-white">
                  {agency.email}
                </a>
              </li>
            )}
            {sedes.map((sede) => (
              <li key={sede.id} className="flex gap-2.5">
                <MapPin size={15} className="mt-0.5 flex-none text-t2" />
                <span>
                  <b className="font-semibold text-white/90">{sede.name}</b>
                  <span className="block text-white/60">{sede.address}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5 text-[12px] text-white/55 sm:px-8">
          <span>
            {agency.legal_name} · RUC {agency.ruc}
          </span>
          {agency.registry && <span>{agency.registry}</span>}
          {fx && (
            <span className="sm:ml-auto">
              {t.footer.fx(fx.rate.toFixed(3), formatDate(fx.date, "short", dateLocale))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, base, links }: { title: string; base: string; links: { path: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-white/90">{title}</h2>
      <ul className="mt-4 grid gap-2.5">
        {links.map((link) => (
          <li key={link.path}>
            <Link href={siteHref(base, link.path)} className="group inline-flex items-center gap-2 text-[13.5px] text-white/65 transition hover:text-white">
              <span aria-hidden className="h-px w-0 bg-t2 transition-all duration-300 group-hover:w-3" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
