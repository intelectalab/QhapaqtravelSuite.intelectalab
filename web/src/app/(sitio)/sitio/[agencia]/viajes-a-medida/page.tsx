import { Clock4, Compass, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { TailorMadeForm } from "@/features/site/Forms";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteDestinations, siteBase } from "@/lib/server/site";
import { pickListing, siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Viajes a medida" };

const STEPS = [
  { icon: MessagesSquare, title: "Cuéntanos tu idea", text: "Destinos, fechas aproximadas y cómo te gusta viajar." },
  { icon: Compass, title: "Diseñamos la ruta", text: "Un asesor arma el itinerario con hoteles, traslados y tours." },
  { icon: Clock4, title: "Respuesta en 24 h hábiles", text: "Recibes la propuesta con precios y la ajustamos contigo." },
];

export default async function TailorMadePage({ params, searchParams }: PageProps<"/sitio/[agencia]/viajes-a-medida">) {
  const [{ agencia }, search] = await Promise.all([params, searchParams]);
  const [{ items }, base] = await Promise.all([getSiteDestinations(agencia), siteBase(agencia)]);
  const picked = pickListing(search);
  const producto = typeof search.producto === "string" ? search.producto : undefined;

  return (
    <>
      <PageHero eyebrow="Viajes a medida" title="Diseñemos tu viaje juntos" description="Combina destinos, elige el ritmo y el tipo de hotel. Te enviamos una propuesta personalizada sin compromiso.">
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Viajes a medida" }]} />
        </div>
      </PageHero>
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_320px]">
        <TailorMadeForm destinations={items.map((item) => ({ value: item.slug, label: item.name }))} initial={{ destino: picked.destino, fecha: picked.fecha, viajeros: picked.viajeros, producto }} />
        <aside className="grid gap-3 lg:sticky lg:top-24 lg:self-start">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="lift flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 70}ms` }}>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-brand">
                <Icon size={18} />
              </span>
              <span>
                <b className="block text-[14px] font-semibold text-fg">{title}</b>
                <span className="text-[13px] leading-relaxed text-fg-2">{text}</span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
