import type { ReactNode } from "react";
import { BadgePercent, Coins, FileText, MailOpen, Megaphone, MousePointerClick, Repeat2, Send, ShieldCheck, Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { TintTile } from "@/components/ui/Tinted";
import { CampaignFormAction } from "@/features/marketing/CampaignForms";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { AutomationsOverview, MarketingOverview } from "@/lib/marketing";
import { getCachedResource } from "@/lib/server/resource";

const BASE = "/marketing/campanas";

export default async function CampanasLayout({ children }: { children: ReactNode }) {
  const [overview, automations] = await Promise.all([
    getCachedResource<MarketingOverview>("/marketing/campaigns", "No pudimos cargar marketing."),
    getCachedResource<AutomationsOverview>("/marketing/automations", "No pudimos cargar las automatizaciones."),
  ]);

  if (!overview) {
    return <PageHeader title="Campañas y segmentos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, consents } = overview;
  const activeAutomations = automations?.automations.filter((automation) => automation.status === "activa").length;

  return (
    <>
      <PageHeader
        title="Campañas y segmentos"
        subtitle="Campañas por email y WhatsApp solo a contactos que dieron su consentimiento."
        info={<InfoTip>Ley 29733: cada envío excluye a quien se dio de baja o no autorizó el canal. Los ingresos se atribuyen a la última campaña recibida en los 30 días previos a la reserva.</InfoTip>}
        actions={overview.can.manage ? <CampaignFormAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <TintTile icon={Send} tone="t1" label="Entregados en 90 días" value={formatNumber(kpis.delivered_90)} note={`de ${formatNumber(kpis.recipients_90)} enviados`} info={<p>Mensajes entregados a destinatarios de las campañas enviadas en los últimos 90 días; el total incluye rebotes y fallos.</p>} />
        <TintTile icon={MailOpen} tone="info" label="Apertura" value={kpis.open_rate !== null ? formatPercent(kpis.open_rate, 0) : "Sin datos"} info={<p>Destinatarios que abrieron o leyeron el mensaje entre los entregados, en las campañas enviadas en los últimos 90 días.</p>} />
        <TintTile icon={MousePointerClick} tone="violet" label="Clics" value={kpis.click_rate !== null ? formatPercent(kpis.click_rate, 0) : "Sin datos"} info={<p>Destinatarios que hicieron clic en un enlace entre los entregados, en las mismas campañas de los últimos 90 días.</p>} />
        <TintTile icon={Coins} tone="ok" label="Ingresos atribuidos" value={formatMoney(kpis.revenue)} note={`${kpis.reservations} reservas`} info={<p>Reservas confirmadas de destinatarios creadas hasta 30 días después del envío y que no vienen de una cotización anterior, convertidas a soles con su tipo de cambio.</p>} />
        <TintTile icon={ShieldCheck} tone="t4" label="Contactables" value={`${kpis.contactable_email} · ${kpis.contactable_whatsapp}`} note="Email · WhatsApp" info={<p>Contactos con consentimiento vigente y un dato válido para el canal: correo para email y celular para WhatsApp.</p>} />
        <TintTile icon={BadgePercent} tone="bad" label="Bajas en 30 días" value={consents.revoked_30} note="Se excluyen al instante" info={<p>Consentimientos revocados en los últimos 30 días por enlace de baja, respuesta BAJA, solicitud ARCO o registro manual.</p>} />
      </section>
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones de marketing"
            testId="marketing-nav"
            groups={[
              {
                title: "Comunicación",
                items: [
                  { href: BASE, label: "Campañas", icon: <Megaphone size={16} /> },
                  { href: `${BASE}/automatizaciones`, label: "Automatizaciones", count: activeAutomations, icon: <Repeat2 size={16} /> },
                ],
              },
              {
                title: "Recursos",
                items: [
                  { href: `${BASE}/segmentos`, label: "Segmentos", count: overview.segments.length, icon: <Users size={16} /> },
                  { href: `${BASE}/plantillas`, label: "Plantillas", count: overview.templates.length, icon: <FileText size={16} /> },
                  { href: `${BASE}/cupones`, label: "Cupones", count: overview.codes.length, icon: <Ticket size={16} /> },
                ],
              },
              {
                title: "Ley 29733",
                items: [{ href: `${BASE}/consentimientos`, label: "Consentimientos", icon: <ShieldCheck size={16} /> }],
              },
            ]}
          />
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
