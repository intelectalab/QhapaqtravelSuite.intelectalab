import { BadgePercent, Coins, MailOpen, MousePointerClick, Send, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { CampaignFormAction } from "@/features/marketing/CampaignForms";
import { MarketingWorkspace } from "@/features/marketing/MarketingWorkspace";
import { formatMoney, formatPercent } from "@/lib/format";
import type { MarketingOverview } from "@/lib/marketing";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Campañas y segmentos" };

export default async function CampanasPage() {
  const overview = await getResource<MarketingOverview>("/marketing/campaigns", "No pudimos cargar marketing.");

  if (!overview) {
    return <PageHeader title="Campañas y segmentos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, consents } = overview;

  return (
    <>
      <PageHeader
        title="Campañas y segmentos"
        subtitle="Campañas por email y WhatsApp solo a contactos que dieron su consentimiento."
        info={<InfoTip>Ley 29733: cada envío excluye a quien se dio de baja o no autorizó el canal. Los ingresos se atribuyen a la última campaña recibida en los 30 días previos a la reserva.</InfoTip>}
        actions={overview.can.manage ? <CampaignFormAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <TintTile icon={Send} tone="t1" label="Enviadas en 90 días" value={kpis.sent_90} />
        <TintTile icon={MailOpen} tone="info" label="Apertura" value={kpis.open_rate !== null ? formatPercent(kpis.open_rate, 0) : "Sin datos"} />
        <TintTile icon={MousePointerClick} tone="violet" label="Clics" value={kpis.click_rate !== null ? formatPercent(kpis.click_rate, 0) : "Sin datos"} />
        <TintTile icon={Coins} tone="ok" label="Ingresos atribuidos" value={formatMoney(kpis.revenue)} note={`${kpis.reservations} reservas`} />
        <TintTile icon={ShieldCheck} tone="t4" label="Contactables" value={`${kpis.contactable_email} · ${kpis.contactable_whatsapp}`} note="Email · WhatsApp" />
        <TintTile icon={BadgePercent} tone="bad" label="Bajas en 30 días" value={consents.revoked_30} note={`${consents.subscribers} suscriptores`} />
      </section>
      <MarketingWorkspace overview={overview} />
    </>
  );
}
