import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/features/site/Forms";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteProfile, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Contacto" };

const REASONS = [
  { value: "cotizar", label: "Quiero cotizar un viaje" },
  { value: "reserva", label: "Tengo una reserva" },
  { value: "pagos", label: "Pagos y comprobantes" },
  { value: "otro", label: "Otra consulta" },
];

export default async function ContactPage({ params }: PageProps<"/sitio/[agencia]/contacto">) {
  const { agencia } = await params;
  const [profile, base] = await Promise.all([getSiteProfile(agencia), siteBase(agencia)]);

  return (
    <>
      <PageHero eyebrow="Contacto" title="Hablemos de tu próximo viaje" description="Escríbenos y te responderemos en horario de oficina. Si quieres una propuesta completa, usa el formulario de viajes a medida.">
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Contacto" }]} />
        </div>
      </PageHero>
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_360px]">
        <ContactForm reasons={REASONS} />
        <aside className="grid gap-3 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="text-[15px] font-semibold text-fg">Canales de atención</h2>
            <ul className="mt-3 grid gap-2.5 text-[13.5px] text-fg-2">
              {profile.agency.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={15} className="text-brand" />
                  <span className="select-all">{profile.agency.phone}</span>
                </li>
              )}
              {profile.agency.email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={15} className="text-brand" />
                  <a href={`mailto:${profile.agency.email}`} className="break-all hover:text-accent">
                    {profile.agency.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
          {profile.sedes.map((sede, index) => (
            <div key={sede.id} className="lift rounded-card border border-line bg-surface p-4 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
              <b className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                <MapPin size={15} className="text-brand" />
                {sede.name}
                {sede.is_main && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-fg-3">Principal</span>}
              </b>
              <p className="mt-1 text-[13px] text-fg-2">{sede.address}</p>
              {sede.phone && <p className="mt-0.5 select-all text-[12.5px] text-fg-3">{sede.phone}</p>}
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
