import { AppWindow, Gauge, KeyRound, Send, Webhook } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { AuditTrail, KpiGrid } from "@/features/admin/AdminParts";
import { ApiKeyCreateAction, ApiKeysTable, DeliveriesTable, OAuthApps, SecretProvider, SecretSlot, WebhookCreateAction, WebhooksGrid } from "@/features/admin/ApiAccess";
import type { ApiOverview } from "@/lib/admin";
import { formatNumber } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "API y webhooks" };

const ratio = (used: number, limit: number | null) => (limit === null ? `${used}` : `${used} de ${limit}`);

export default async function ApiPage() {
  const data = await getResource<ApiOverview>("/admin/api", "No pudimos cargar la API.");
  if (!data) return <NoAccess home="/dashboard" />;
  const activeKeys = data.keys.filter((key) => key.status === "active").length;
  const keysFull = data.limits.api_keys !== null && activeKeys >= data.limits.api_keys ? "Llegaste al máximo de claves activas de tu plan: revoca una antes de crear otra." : null;
  const hooksFull = data.limits.webhooks !== null && data.webhooks.length >= data.limits.webhooks ? "Llegaste al máximo de webhooks de tu plan." : null;
  const pending = data.deliveries.filter((delivery) => delivery.status === "retrying" || delivery.status === "failed").length;

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
      <KpiGrid>
        <TintTile icon={KeyRound} tone="t1" label="Claves activas" value={ratio(activeKeys, data.limits.api_keys)} note="Según tu plan" />
        <TintTile icon={Webhook} tone="t4" label="Webhooks" value={ratio(data.webhooks.length, data.limits.webhooks)} note={`${data.webhooks.filter((hook) => hook.status === "active").length} activos`} />
        <TintTile icon={Gauge} tone="violet" label="Llamadas del mes" value={formatNumber(data.calls_month)} note={data.limits.calls_month !== null ? `Límite ${formatNumber(data.limits.calls_month)} · ${data.limits.rate_per_min ?? "—"} por minuto` : "Sin límite"} />
        <TintTile icon={Send} tone={pending > 0 ? "warn" : "ok"} label="Entregas por resolver" value={pending} note="Reintentando o fallidas" />
      </KpiGrid>

      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <KeyRound size={17} className="text-accent" />
        Claves de API
      </h2>
      <ApiKeysTable data={data} />

      <h2 className="mb-3 mt-6 flex items-center gap-2 text-[15px] font-semibold">
        <Webhook size={17} className="text-accent" />
        Webhooks
      </h2>
      <WebhooksGrid data={data} />

      <h2 className="mb-3 mt-6 flex items-center gap-2 text-[15px] font-semibold">
        <Send size={17} className="text-accent" />
        Historial de entregas
      </h2>
      <DeliveriesTable data={data} />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={AppWindow} title="Aplicaciones conectadas por OAuth" aside={`${data.apps.length}`} />
          <OAuthApps apps={data.apps} scopes={data.scopes} />
        </Card>
        <AuditTrail entries={data.history} empty="Aún no hay cambios en claves ni webhooks." />
      </div>
    </SecretProvider>
  );
}
