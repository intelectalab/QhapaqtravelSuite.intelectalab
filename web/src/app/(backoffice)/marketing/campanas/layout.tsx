import type { ReactNode } from "react";
import { FileText, Megaphone, Repeat2, ShieldCheck, Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { CampaignFormAction } from "@/features/marketing/CampaignForms";
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

  const activeAutomations = automations?.automations.filter((automation) => automation.status === "activa").length;

  return (
    <>
      <PageHeader
        title="Campañas y segmentos"
        subtitle="Campañas por email y WhatsApp solo a contactos que dieron su consentimiento."
        info={<InfoTip>Ley 29733: cada envío excluye a quien se dio de baja o no autorizó el canal. Los ingresos se atribuyen a la última campaña recibida en los 30 días previos a la reserva.</InfoTip>}
        actions={overview.can.manage ? <CampaignFormAction overview={overview} /> : undefined}
      />
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
