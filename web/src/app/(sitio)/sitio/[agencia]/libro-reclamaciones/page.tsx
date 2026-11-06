import { BookOpenText } from "lucide-react";
import type { Metadata } from "next";
import { ClaimForm } from "@/features/site/Forms";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteProfile, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Libro de Reclamaciones" };

export default async function ClaimBookPage({ params }: PageProps<"/sitio/[agencia]/libro-reclamaciones">) {
  const { agencia } = await params;
  const [profile, base] = await Promise.all([getSiteProfile(agencia), siteBase(agencia)]);
  const sedes = profile.sedes.map((sede) => ({ value: sede.id, label: sede.name }));

  return (
    <>
      <PageHero eyebrow="Ley 29571 · D.S. 011-2011-PCM" title="Libro de Reclamaciones" description={`Hoja de reclamación virtual de ${profile.agency.legal_name} (RUC ${profile.agency.ruc}). Respondemos en un plazo máximo de ${profile.claims_days} días hábiles.`}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Libro de Reclamaciones" }]} />
        </div>
      </PageHero>
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_320px]">
        <ClaimForm sedes={sedes} responseDays={profile.claims_days} />
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <BookOpenText size={22} className="text-brand" />
            <h2 className="mt-3 text-[15px] font-semibold text-fg">Proveedor</h2>
            <dl className="mt-2 grid gap-1.5 text-[13px] text-fg-2">
              <dt className="text-fg-3">Razón social</dt>
              <dd className="font-semibold text-fg">{profile.agency.legal_name}</dd>
              <dt className="mt-1 text-fg-3">RUC</dt>
              <dd className="font-semibold text-fg">{profile.agency.ruc}</dd>
              <dt className="mt-1 text-fg-3">Domicilio</dt>
              <dd>{profile.agency.address}</dd>
            </dl>
            <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-2">Al registrar la hoja recibirás una constancia con su número y la fecha límite de respuesta en tu correo.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
