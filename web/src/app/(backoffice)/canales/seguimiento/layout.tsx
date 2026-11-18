import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { getCachedResource } from "@/lib/server/resource";
import type { TrackingOverview } from "@/lib/tracking";

export default async function SeguimientoLayout({ children }: { children: ReactNode }) {
  const overview = await getCachedResource<TrackingOverview>("/marketing/tracking/tags", "No pudimos cargar las etiquetas del sitio.");

  if (!overview) {
    return <PageHeader title="Seguimiento y píxeles" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, rows } = overview;
  const scripts = rows.filter((row) => row.provider === "script").length;

  return (
    <>
      <PageHeader
        title="Seguimiento y píxeles"
        subtitle="Conecta Google Analytics, Google Ads, Meta y otras herramientas sin tocar código."
        info={<InfoTip>Cada etiqueta carga solo si el visitante acepta su categoría de cookies (Consent Mode v2) y nunca en la página de pago. Política de cookies {overview.consent.policy_version}.</InfoTip>}
        actions={
          <Link href="/reportes/visitas" className="inline-flex h-9 items-center rounded-control border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:-translate-y-0.5 hover:text-fg">
            Ver visitas del sitio
          </Link>
        }
      />
      <TabbedCard
        tabs={[
          { href: "/canales/seguimiento", label: "Etiquetas", count: rows.length - scripts },
          { href: "/canales/seguimiento/conversiones", label: "Conversiones", count: kpis.mapped_events },
          { href: "/canales/seguimiento/scripts", label: "Scripts propios", count: scripts },
          { href: "/canales/seguimiento/envios", label: "Envíos" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
