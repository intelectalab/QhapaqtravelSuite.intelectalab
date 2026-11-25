import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { SITE_LINKS } from "@/lib/software";
import { LandingPopups } from "./blog/LandingPopups";
import { NewsletterForm } from "./blog/NewsletterForm";
import { hasAgencySession } from "./data";
import { DemoTour } from "./DemoTour";
import { SiteBrand, SiteHeader } from "./SiteHeader";
import "./site.css";

const LEGAL_LINKS = [
  { href: "/software/legal/terminos", label: "Términos del servicio" },
  { href: "/software/legal/privacidad", label: "Privacidad" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-[0.12em] text-white/45">{title}</p>
      <ul className="mt-3 grid gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="inline-block text-[14px] text-white/75 transition hover:translate-x-0.5 hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SiteFrame({ children }: { children: ReactNode }) {
  const signedIn = await hasAgencySession();

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-bg">
      <div aria-hidden className="weave-band site-weave-run h-1.5 bg-[length:112px_100%]" />
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <footer className="relative isolate overflow-hidden bg-menu text-white">
        <span aria-hidden className="weave-tint absolute inset-0 -z-10 bg-white opacity-[0.04] [mask-size:36px_36px]" />
        <span aria-hidden className="absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-t1 opacity-40 blur-[110px]" />
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1.35fr]">
          <div className="max-w-sm">
            <SiteBrand inverted />
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/60">Software de gestión para agencias de viaje y operadores turísticos del Perú. Del primer mensaje al viaje cobrado.</p>
          </div>
          <FooterColumn title="Producto" links={SITE_LINKS} />
          <FooterColumn title="Tu cuenta" links={[{ href: signedIn ? "/dashboard" : "/login", label: signedIn ? "Ir a mi panel" : "Ingresar" }, { href: "/software/suscribirse?ciclo=prueba", label: "Empezar prueba" }, ...LEGAL_LINKS]} />
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-white/45">Boletín mensual</p>
            <p className="mb-3 mt-3 text-[14px] font-semibold text-white">Ventas, SUNAT, operación e IA para agencias.</p>
            <NewsletterForm source="pie" tone="dark" />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[12.5px] text-white/45 sm:px-8">
            <span>© {new Date().getFullYear()} KipuControl Cloud S.A.C.</span>
            <nav aria-label="Legal" className="flex gap-4">
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
      <LandingPopups signedIn={signedIn} />
      <Suspense fallback={null}>
        <DemoTour />
      </Suspense>
    </div>
  );
}
