import { AlertTriangle, Send, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { formatNumber } from "@/lib/format";
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
      <TileGrid>
        <TintTile icon={Target} tone="t4" label="Etiquetas activas" value={formatNumber(kpis.active)} note={`${kpis.configured} configuradas`} info={<p>Etiquetas en estado activo, sin contar las pausadas ni las eliminadas. Salen de la lista de etiquetas del sitio.</p>} />
        <TintTile icon={Send} tone="ok" label="Conversiones enviadas (24 h)" value={formatNumber(kpis.sent_24h)} note={`${kpis.deduplicated_24h} deduplicadas por event_id`} info={<p>Envíos aceptados por los proveedores en las últimas 24 horas, según el registro de envíos.</p>} />
        <TintTile icon={AlertTriangle} tone={kpis.failed > 0 ? "bad" : "info"} label="Envíos con error" value={formatNumber(kpis.failed)} note={kpis.failed > 0 ? "Revisa la pestaña Envíos" : "Todo en orden"} info={<p>Envíos fallidos que todavía se pueden reintentar (hasta 10 intentos). Se guardan 90 días.</p>} />
        <TintTile icon={ShieldCheck} tone={kpis.in_review > 0 ? "sun" : "violet"} label="Por revisar" value={formatNumber(kpis.in_review)} note="Scripts o cambios por aprobar" info={<p>Scripts propios en revisión y cambios de scripts activos que esperan la aprobación de otra persona.</p>} />
      </TileGrid>
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
