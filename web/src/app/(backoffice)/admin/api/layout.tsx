import { AppWindow, CheckCircle2, Gauge, KeyRound, Send, Timer, UserCheck, Webhook } from "lucide-react";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { ApiKeyCreateAction, SecretProvider, SecretSlot, WebhookCreateAction } from "@/features/admin/ApiAccess";
import { formatNumber, formatPercent } from "@/lib/format";
import { getApiAccess } from "@/lib/server/adminSections";

const BASE = "/admin/api";
const MONTH_MS = 30 * 24 * 3600 * 1000;

export default async function ApiLayout({ children }: { children: ReactNode }) {
  const data = await getApiAccess();
  if (!data) return <NoAccess home="/dashboard" />;
  const activeKeys = data.keys.filter((key) => key.status === "active").length;
  const keysFull = data.limits.api_keys !== null && activeKeys >= data.limits.api_keys ? "Llegaste al máximo de claves activas de tu plan: revoca una antes de crear otra." : null;
  const hooksFull = data.limits.webhooks !== null && data.webhooks.length >= data.limits.webhooks ? "Llegaste al máximo de webhooks de tu plan." : null;
  const finished = data.deliveries.filter((delivery) => delivery.status !== "pending");
  const delivered = finished.filter((delivery) => delivery.status === "delivered").length;
  const timed = data.deliveries.filter((delivery) => delivery.ms !== null);
  const average = timed.length > 0 ? Math.round(timed.reduce((sum, delivery) => sum + (delivery.ms ?? 0), 0) / timed.length) : null;
  const since = new Date().getTime() - MONTH_MS;
  const used = data.keys.filter((key) => key.last_used_at && new Date(key.last_used_at).getTime() >= since).length;

  return (
    <SecretProvider>
      <PageHeader
        title="API y webhooks"
        subtitle="Conecta tu ERP, tu sitio web o tus herramientas de marketing con los datos de tu agencia."
        info={<InfoTip>Las claves autentican a la agencia, no a una persona, y solo se muestran completas al crearlas: guardamos un resumen cifrado. Los webhooks se firman con HMAC-SHA256 y se deshabilitan tras 10 fallos seguidos.</InfoTip>}
        actions={
          data.can_manage ? (
            <>
              <WebhookCreateAction events={data.events} full={hooksFull} />
              <ApiKeyCreateAction scopes={data.scopes} full={keysFull} />
            </>
          ) : undefined
        }
      />
      <SecretSlot />
      <KpiGrid columns={3}>
        <TintTile icon={CheckCircle2} tone={finished.length > 0 && delivered / finished.length < 0.9 ? "warn" : "ok"} label="Tasa de entrega" value={finished.length > 0 ? formatPercent((delivered / finished.length) * 100, 1) : "Sin entregas"} info={<p>Entregas de webhooks que tu servidor aceptó entre todas las que ya terminaron. Las que siguen en cola no cuentan.</p>} />
        <TintTile icon={Timer} tone="t1" label="Respuesta promedio" value={average === null ? "Sin datos" : `${formatNumber(average)} ms`} info={<p>Tiempo promedio que tarda tu servidor en responder cada entrega de webhook, con las últimas entregas registradas.</p>} />
        <TintTile icon={UserCheck} tone="violet" label="Claves en uso" value={used} note="Con llamadas en los últimos 30 días" info={<p>Claves que hicieron al menos una llamada en los últimos 30 días, según su último uso.</p>} />
      </KpiGrid>
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones de la API"
            testId="api-nav"
            groups={[
              {
                title: "Acceso",
                items: [
                  { href: BASE, label: "API keys", count: data.keys.length, icon: <KeyRound size={16} /> },
                  { href: `${BASE}/oauth`, label: "Aplicaciones OAuth", count: data.apps.length, icon: <AppWindow size={16} /> },
                  { href: `${BASE}/limites`, label: "Límites y rate limit", icon: <Gauge size={16} /> },
                ],
              },
              {
                title: "Eventos",
                items: [
                  { href: `${BASE}/webhooks`, label: "Webhooks", count: data.webhooks.length, icon: <Webhook size={16} /> },
                  { href: `${BASE}/entregas`, label: "Log de entregas", count: data.deliveries.length, icon: <Send size={16} /> },
                ],
              },
            ]}
          />
        }
      >
        {children}
      </SectionLayout>
    </SecretProvider>
  );
}
