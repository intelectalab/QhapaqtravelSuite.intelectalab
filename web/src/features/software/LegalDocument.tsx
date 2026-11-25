import { FileWarning } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/landing-content";
import { PageHero } from "./Section";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalText {
  title: string;
  summary: string;
  version: string;
  updated: string;
  sections: LegalSection[];
}

export const LEGAL_PAGES = [
  { href: "/software/legal/terminos", label: "Términos del servicio" },
  { href: "/software/legal/privacidad", label: "Política de privacidad" },
];

export function LegalDocument({ text, current }: { text: LegalText; current: string }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={text.title} description={text.summary} />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Documentos legales" className="grid gap-1 rounded-[18px] border border-line bg-surface p-2">
            {LEGAL_PAGES.map((page) => (
              <Link key={page.href} href={page.href} aria-current={page.href === current ? "page" : undefined} className={cn("rounded-[12px] px-3 py-2 text-[13.5px] font-semibold transition", page.href === current ? "bg-surface-2 text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
                {page.label}
              </Link>
            ))}
          </nav>
          <ol className="mt-4 hidden gap-1 px-2 lg:grid">
            {text.sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#${slugify(section.title)}`} className="flex gap-2 rounded-[8px] px-1.5 py-1 text-[12.5px] text-fg-3 transition hover:text-fg">
                  <span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>
        <div className="min-w-0 max-w-[760px]">
          <div role="note" className="flex gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] p-4">
            <FileWarning size={20} className="mt-0.5 flex-none text-warn" />
            <p className="text-[14px] leading-relaxed text-fg-2">
              <b className="text-fg">Texto provisional, pendiente de revisión legal.</b> Este documento resume cómo funciona hoy KipuControl. Su versión final la aprobará la gerencia con su asesoría legal antes del lanzamiento comercial.
            </p>
          </div>
          <p className="mt-6 font-mono text-[12px] text-fg-3">
            Versión {text.version} · actualizado el {text.updated}
          </p>
          {text.sections.map((section, index) => (
            <section key={section.title} id={slugify(section.title)} className="mt-10 scroll-mt-28">
              <h2 className="site-display text-[22px] font-bold tracking-[-0.02em] text-fg">
                <span className="mr-2 font-mono text-[15px] text-fg-3">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-[15.5px] leading-[1.75] text-fg-2">
                  {paragraph}
                </p>
              ))}
              {section.items && (
                <ul className="mt-3 grid gap-2">
                  {section.items.map((item) => (
                    <li key={item} className="relative pl-5 text-[15px] leading-relaxed text-fg-2 before:absolute before:left-0.5 before:top-[0.65em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-t1">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
