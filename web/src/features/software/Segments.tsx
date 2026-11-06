import { ArrowRight, Briefcase, Building2, Compass, Globe2, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { screensOf, NAV_GROUPS } from "@/config/navigation";
import { planTone } from "@/lib/platform";
import { contactHref, type SoftwareOverview } from "@/lib/software";
import { toneStyle, type Tone } from "@/lib/tone";
import { Reveal } from "./Reveal";

interface SegmentInfo {
  icon: LucideIcon;
  tone: Tone;
  pitch: string;
  screens: string[];
}

const SEGMENTS: Record<string, SegmentInfo> = {
  "Agencia de viajes minorista": { icon: Store, tone: "t3", pitch: "Atiende consultas de WhatsApp y web, arma cotizaciones con versiones y cobra en cuotas sin perder el hilo de cada cliente.", screens: ["/crm/leads", "/cotizaciones", "/finanzas/cobros", "/canales/portal-cliente"] },
  "Operador turístico": { icon: Compass, tone: "t4", pitch: "Programa salidas, controla cupos y asigna guías y movilidad con la lista de pasajeros siempre actualizada.", screens: ["/catalogo/salidas", "/catalogo/cupos", "/operaciones/asignaciones", "/operaciones/vouchers"] },
  "DMC / receptivo": { icon: Globe2, tone: "t1", pitch: "Recibe pedidos de agencias del exterior, cotiza en varias monedas y coordina proveedores en cada destino.", screens: ["/canales/b2b", "/catalogo/tarifas", "/operaciones/ordenes", "/admin/monedas"] },
  "Agencia corporativa": { icon: Briefcase, tone: "violet", pitch: "Gestiona viajes de empresas con aprobaciones internas, documentos de viaje y facturación por cliente corporativo.", screens: ["/aprobaciones", "/operaciones/documentos-viaje", "/finanzas/facturacion", "/reportes"] },
  Mayorista: { icon: Building2, tone: "t2", pitch: "Distribuye tu producto a agencias aliadas con tarifas netas, comisiones y conciliación de lo vendido.", screens: ["/canales/b2b", "/finanzas/comisiones", "/catalogo/productos", "/finanzas/conciliacion"] },
};

const SCREENS = new Map(screensOf(NAV_GROUPS).map((screen) => [screen.href, screen]));

export function Segments({ segments }: { segments: SoftwareOverview["segments"] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {segments.map((segment, index) => {
        const info = SEGMENTS[segment.type];
        if (!info) return null;
        const Icon = info.icon;
        return (
          <Reveal key={segment.type} delay={(index % 3) * 80} className={index === 0 ? "lg:col-span-2" : undefined}>
            <article style={toneStyle(info.tone)} className="lift group relative isolate flex h-full flex-col overflow-hidden rounded-card border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-6 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]">
              <Icon aria-hidden size={140} strokeWidth={1.2} className="pointer-events-none absolute -bottom-8 -right-6 -z-10 text-[var(--tint)] opacity-[0.07] transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110" />
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--tint)] text-white shadow-[0_10px_22px_-12px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                  <Icon size={22} />
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[26px] font-bold leading-none text-fg">{segment.agencies}</span>
                  <span className="text-[12px] text-fg-3">{segment.agencies === 1 ? "agencia lo usa" : "agencias lo usan"}</span>
                </span>
              </div>
              <h3 className="mt-5 text-[19px] font-bold tracking-tight text-fg">{segment.type}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{info.pitch}</p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {info.screens.map((href) => {
                  const screen = SCREENS.get(href);
                  if (!screen) return null;
                  return (
                    <li key={href} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-fg-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:text-[var(--tint)]">
                      <screen.icon size={12} />
                      {screen.label}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                {segment.plan && segment.plan_name && segment.plan_rank ? (
                  <span style={toneStyle(planTone(segment.plan_rank))} className="rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2.5 py-1 text-[12px] font-semibold text-[var(--tint)]">
                    Suelen elegir {segment.plan_name}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-fg-3">Te ayudamos a elegir el plan</span>
                )}
                <Link href={contactHref("demo", segment.plan ?? undefined)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--tint)]">
                  Ver una demo
                  <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}
