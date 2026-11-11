import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_LINKS } from "@/lib/software";
import { hasAgencySession } from "./data";
import { SiteBrand, SiteHeader } from "./SiteHeader";
import "./site.css";

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
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <SiteBrand inverted />
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/60">Software de gestión para agencias de viaje y operadores turísticos del Perú. Del primer mensaje al viaje cobrado.</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-white/45">Producto</p>
            <ul className="mt-3 grid gap-2">
              {SITE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[14px] text-white/75 transition hover:translate-x-0.5 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-white/45">Tu cuenta</p>
            <ul className="mt-3 grid gap-2">
              <li>
                <Link href={signedIn ? "/dashboard" : "/login"} className="text-[14px] text-white/75 transition hover:text-white">
                  {signedIn ? "Ir a mi panel" : "Ingresar"}
                </Link>
              </li>
              <li>
                <Link href="/software/contacto?tipo=prueba" className="text-[14px] text-white/75 transition hover:text-white">
                  Empezar prueba
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[12.5px] text-white/45 sm:px-8">
            <span>© {new Date().getFullYear()} KipuControl Cloud S.A.C.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
