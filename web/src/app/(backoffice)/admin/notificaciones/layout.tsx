import { BellRing, CheckCircle2, Send } from "lucide-react";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { formatPercent } from "@/lib/format";
import { getNotifications } from "@/lib/server/adminSections";

const BASE = "/admin/notificaciones";

export default async function NotificacionesLayout({ children }: { children: ReactNode }) {
  const data = await getNotifications();
  if (!data) return <NoAccess home="/dashboard" />;
  const settled = data.kpis.messages - data.kpis.pending;
  const delivery = settled > 0 ? ((settled - data.kpis.failed) / settled) * 100 : null;

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle="Qué eventos del negocio se avisan, por qué canal, con qué texto y cómo salió cada envío."
        info={<InfoTip>Un fallo de envío nunca deshace la operación que lo originó. Los errores temporales se reintentan; los permanentes, como un número no registrado en WhatsApp, se pueden reenviar por correo.</InfoTip>}
      />
      <KpiGrid columns={3}>
        <TintTile icon={Send} tone="t1" label="Enviados en 7 días" value={data.kpis.sent_7d} info={<p>Avisos con estado enviado creados en los últimos 7 días, por cualquier canal.</p>} />
        <TintTile icon={CheckCircle2} tone="ok" label="Tasa de entrega" value={delivery === null ? "Sin envíos" : formatPercent(delivery, 1)} info={<p>Envíos que salieron bien entre todos los que ya terminaron, enviados o fallidos. Los que siguen en cola no cuentan.</p>} />
        <TintTile icon={BellRing} tone="violet" label="Avisos encendidos" value={data.kpis.routes} note="Combinaciones evento y canal" info={<p>Suma de los canales encendidos en cada evento de la matriz. Un evento con correo y WhatsApp cuenta dos.</p>} />
      </KpiGrid>
      <TabbedCard
        tabs={[
          { href: BASE, label: "Matriz de avisos", count: data.rules.length },
          { href: `${BASE}/plantillas`, label: "Plantillas" },
          { href: `${BASE}/envios`, label: "Registro de envíos", count: data.messages.length },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
