import { AppWindow, Lock } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { OAuthAppCreateAction, OAuthAppList, type OAuthApp } from "@/features/admin/OAuthApps";
import { getApiAccess } from "@/lib/server/adminSections";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Aplicaciones OAuth" };

async function publicOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ApiOAuthPage() {
  const data = await getApiAccess();
  if (!data) return null;
  const apps = await getResource<OAuthApp[]>("/integrations/oauth-apps", "No pudimos cargar las aplicaciones OAuth.");
  const origin = await publicOrigin();

  return (
    <Card>
      <TintCardTitle icon={AppWindow} title="Aplicaciones conectadas por OAuth" aside={apps && data.can_manage ? <OAuthAppCreateAction scopes={data.scopes} /> : undefined} />
      {apps ? (
        <>
          <OAuthAppList apps={apps} scopes={data.scopes} canManage={data.can_manage} />
          <dl className="mt-4 grid gap-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="flex items-center gap-1 text-fg-3">
                Dirección de autorización
                <InfoTip>El proveedor envía aquí a la persona de tu agencia para que apruebe el acceso. Solo se acepta Authorization Code con PKCE (S256).</InfoTip>
              </dt>
              <dd className="truncate font-mono text-fg-2">{origin}/oauth/authorize</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center gap-1 text-fg-3">
                Dirección de tokens
                <InfoTip>El proveedor canjea aquí el código por un token de una hora y lo renueva sin volver a pedir permiso. Cada llamada cuenta para la cuota mensual de la API.</InfoTip>
              </dt>
              <dd className="truncate font-mono text-fg-2">{origin}/oauth/token</dd>
            </div>
          </dl>
        </>
      ) : (
        <EmptyState icon={<Lock size={20} />} title="Disponible en el plan Enterprise" description="Las aplicaciones OAuth permiten que un proveedor actúe en nombre de tu agencia sin compartir claves. Mejora el plan desde Suscripción para usarlas." />
      )}
    </Card>
  );
}
