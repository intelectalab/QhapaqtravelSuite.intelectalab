import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { getNotifications } from "@/lib/server/adminSections";

const BASE = "/admin/notificaciones";

export default async function NotificacionesLayout({ children }: { children: ReactNode }) {
  const data = await getNotifications();
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle="Qué eventos del negocio se avisan, por qué canal, con qué texto y cómo salió cada envío."
        info={<InfoTip>Un fallo de envío nunca deshace la operación que lo originó. Los errores temporales se reintentan; los permanentes, como un número no registrado en WhatsApp, se pueden reenviar por correo.</InfoTip>}
      />
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
