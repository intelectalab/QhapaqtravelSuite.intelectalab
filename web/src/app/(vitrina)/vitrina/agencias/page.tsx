import { BadgeCheck, Building2, Check, Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AgencyForm } from "@/features/rutas-libres/Forms";
import { Section, SectionHead } from "@/features/rutas-libres/Shell";
import { formatMoney, formatNumber } from "@/lib/format";
import type { RlOverview } from "@/lib/rutas-libres";
import { getRlOverview, rlOrigin } from "@/lib/server/rutas-libres";

const BILLING: Record<string, string> = { unico: "Pago único", mensual: "Mensual", ambos: "Único o mensual" };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Publique sus free tours gratis", description: "Agencias y guías: publiquen free tours sin costo en Rutas Libres y vendan más con su propio sitio web, SEO y cobros en línea.", alternates: { canonical: `${await rlOrigin()}/agencias` } };
}

function plans(overview: RlOverview) {
  const { rules, pass } = overview;
  return [
    { name: "Vitrina gratis", price: formatMoney(0, "PEN"), note: "para siempre", highlight: false, features: ["Free tours ilimitados", `${rules.free_monthly_bookings} reservas al mes sin costo; luego ${formatMoney(rules.fee_per_attendee, rules.fee_currency)} por asistente`, `Tours de pago con ${Number(rules.commission_pct.none)} % de comisión`, "Perfil de agencia y reseñas verificadas"] },
    { name: `Pase Básico ${pass.days} días`, price: formatMoney(pass.price, pass.currency), note: "pago único o cortesía", highlight: true, features: ["El back-office con las funciones que elija", "Su sitio web con dominio propio y SSL", "Free tours sin cargo por asistente durante el pase", "Pase a un plan cuando quiera, sin perder datos"] },
    ...overview.plans.slice(0, 2).map((plan) => ({ name: plan.name, price: formatMoney(plan.price_month, plan.currency), note: "al mes, sin IGV", highlight: false, features: ["CRM, catálogo, cotizaciones y reservas", `Comisión de vitrina ${Number(plan.commission_pct)} %`, "Free tours sin cargo por asistente", "Add-ons: PayPal, SEO y blog, dominio"] })),
  ];
}

export default async function AgenciesPage() {
  const overview = await getRlOverview();
  const stats = [
    { label: "Visitas este mes", value: formatNumber(overview.stats.month_visits) },
    { label: "Reservas este mes", value: formatNumber(overview.stats.month_bookings) },
    { label: "Agencias publicando", value: formatNumber(overview.stats.agencies) },
    { label: "Ciudades", value: formatNumber(overview.stats.cities) },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(29,78,216,0.18),transparent_45%),radial-gradient(circle_at_90%_40%,rgba(5,150,105,0.14),transparent_40%)]" />
        <div className="rl-wrap relative pb-6 pt-16 text-center sm:pt-24">
          <span className="rl-tag rl-tag-cobalt rl-rise"><Building2 size={14} />Para agencias y guías</span>
          <h1 className="rl-h1 rl-rise mx-auto mt-5 max-w-[18ch]" style={{ animationDelay: "60ms" }}>Su agencia, vista por <span className="text-[var(--rl-cobalt)]">miles de viajeros</span></h1>
          <p className="rl-muted rl-rise mx-auto mt-5 max-w-[60ch] text-[18px]" style={{ animationDelay: "120ms" }}>Publique sus free tours gratis en {overview.brand.name}. Los viajeros reservan con nombre y correo y usted recibe la lista en su correo o en KipuControl.</p>
          <div className="rl-rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "180ms" }}>
            <Link href="#registro" className="rl-cta"><Plus size={16} />Publicar mi primer tour</Link>
            <Link href="#planes" className="rl-btn">Ver planes</Link>
          </div>
        </div>
      </section>

      <Section className="!pt-10">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} style={{ animationDelay: `${index * 70}ms` }} className="rl-card rl-hover rl-rise p-6">
              <dt className="rl-muted text-[13px] font-semibold">{stat.label}</dt>
              <dd className="mt-1 text-[32px] font-extrabold tracking-tight text-[var(--rl-cobalt)]">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <SectionHead kicker="Beneficios" title="Por qué publicar aquí" />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {overview.benefits.map(([title, note]) => (
            <li key={title} className="rl-card rl-hover flex gap-3 p-6"><BadgeCheck size={22} className="flex-none text-[var(--rl-emerald)]" /><span><b className="block text-[15px]">{title}</b><span className="rl-muted text-[14px]">{note}</span></span></li>
          ))}
        </ul>
      </Section>

      <Section>
        <div id="planes" className="scroll-mt-28" />
        <SectionHead kicker="Planes" title="Empiece gratis y crezca a su ritmo" description="Precios sin IGV. Los add-ons se compran aparte, con pago único o mensual." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans(overview).map((plan) => (
            <article key={plan.name} className={`rl-card rl-hover flex flex-col gap-4 p-7 ${plan.highlight ? "border-[var(--rl-cobalt)] shadow-[var(--rl-shadow-float)]" : ""}`}>
              {plan.highlight && <span className="rl-tag rl-tag-coral self-start">Recomendado</span>}
              <h3 className="rl-h3">{plan.name}</h3>
              <p><span className="text-[30px] font-extrabold tracking-tight">{plan.price}</span> <span className="rl-muted text-[13px]">{plan.note}</span></p>
              <ul className="flex flex-col gap-2.5 text-[14px]">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check size={16} className="mt-0.5 flex-none text-[var(--rl-emerald)]" />{feature}</li>)}
              </ul>
            </article>
          ))}
        </div>
        {overview.addons.length > 0 && (
          <div className="rl-card mt-6 overflow-x-auto p-6">
            <h3 className="rl-h3 mb-4">Add-ons sin cambiar de plan</h3>
            <table className="w-full min-w-[560px] text-[14px]">
              <thead><tr className="rl-muted border-b border-[var(--rl-line)] text-left text-[12.5px]"><th className="py-2 font-semibold">Add-on</th><th className="py-2 font-semibold">Cobro</th><th className="py-2 text-right font-semibold">Pago único</th><th className="py-2 text-right font-semibold">Mensual</th></tr></thead>
              <tbody>
                {overview.addons.map((addon) => (
                  <tr key={addon.code} className="border-b border-[var(--rl-line)] transition-colors last:border-0 hover:bg-[var(--rl-surface-2)]">
                    <td className="py-3 font-semibold">{addon.label}</td>
                    <td className="rl-muted py-3">{BILLING[addon.billing_mode]}</td>
                    <td className="py-3 text-right">{addon.price_once ? formatMoney(addon.price_once, "PEN") : "—"}</td>
                    <td className="py-3 text-right">{addon.price_month ? formatMoney(addon.price_month, "PEN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section>
        <div id="registro" className="rl-panel mx-auto max-w-[780px] scroll-mt-28 p-7 sm:p-10">
          <span className="rl-kicker">Registro</span>
          <h2 className="rl-h2 mt-1 text-[28px]">Registre su agencia</h2>
          <p className="rl-muted mb-6 mt-2 flex items-start gap-2 text-[14px]"><ShieldCheck size={17} className="mt-0.5 flex-none text-[var(--rl-emerald)]" />Revisamos cada agencia (RUC, licencia de turismo y fotos propias) antes de publicar. Respondemos en un día hábil.</p>
          <AgencyForm cities={overview.cities.length > 0 ? overview.cities.map((city) => city.id) : ["lima", "cusco", "arequipa", "puno"]} />
        </div>
      </Section>
    </>
  );
}
