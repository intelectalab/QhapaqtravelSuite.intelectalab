import { AlertTriangle, AppWindow, BookOpen, Gauge, KeyRound, Send, Webhook } from "lucide-react";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { ApiKeyCreateAction, SecretProvider, SecretSlot, WebhookCreateAction } from "@/features/admin/ApiAccess";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { getApiAccess } from "@/lib/server/adminSections";

const BASE = "/admin/api";

export default async function ApiLayout({ children }: { children: ReactNode }) {
  const data = await getApiAccess();
  if (!data) return <NoAccess home="/dashboard" />;
  const activeKeys = data.keys.filter((key) => key.status === "active").length;
  const keysFull = data.limits.api_keys !== null && activeKeys >= data.limits.api_keys ? "Llegaste al máximo de claves activas de tu plan: revoca una antes de crear otra." : null;
  const hooksFull = data.limits.webhooks !== null && data.webhooks.length >= data.limits.webhooks ? "Llegaste al máximo de webhooks de tu plan." : null;
  const quota = data.limits.calls_month ? (data.calls_month / data.limits.calls_month) * 100 : null;

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
              <ApiKeyCreateAction scopes={data.scopes} owners={{ modes: data.owner_modes, advisors: data.advisors }} full={keysFull} />
            </>
          ) : undefined
        }
      />
      <SecretSlot />
      {quota !== null && quota >= 80 && (
        <div role="status" className={cn("mb-5 flex items-start gap-3 rounded-[14px] border px-4 py-3 text-[13.5px]", quota >= 100 ? "border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_6%,var(--surface))]" : "border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))]")}>
          <AlertTriangle size={17} className={cn("mt-px flex-none", quota >= 100 ? "text-bad" : "text-warn")} />
          <p className="min-w-0 flex-1">
            <b className="font-semibold">Cuota mensual de la API al {formatNumber(Math.floor(quota))} %</b>
            <span className="text-fg-2"> · {formatNumber(data.calls_month)} de {formatNumber(data.limits.calls_month ?? 0)} llamadas. {quota >= 100 ? "Llegaste al límite del plan: amplía tu plan para seguir llamando a la API este mes." : "Al llegar al 100 % se detienen las llamadas hasta el próximo mes."}</span>
          </p>
        </div>
      )}
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
              {
                title: "Ayuda",
                items: [{ href: `${BASE}/documentacion`, label: "Documentación", icon: <BookOpen size={16} /> }],
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
