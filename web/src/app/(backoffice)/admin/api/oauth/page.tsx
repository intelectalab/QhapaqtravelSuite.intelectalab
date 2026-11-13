import { AppWindow, Lock } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintCardTitle } from "@/components/ui/Tinted";
import { OAuthAppCreateAction, OAuthAppList, type OAuthApp } from "@/features/admin/OAuthApps";
import { getApiAccess } from "@/lib/server/adminSections";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Aplicaciones OAuth" };

export default async function ApiOAuthPage() {
  const data = await getApiAccess();
  if (!data) return null;
  const apps = await getResource<OAuthApp[]>("/integrations/oauth-apps", "No pudimos cargar las aplicaciones OAuth.");

  return (
    <Card>
      <TintCardTitle icon={AppWindow} title="Aplicaciones conectadas por OAuth" aside={apps && data.can_manage ? <OAuthAppCreateAction scopes={data.scopes} /> : undefined} />
      {apps ? (
        <OAuthAppList apps={apps} scopes={data.scopes} canManage={data.can_manage} />
      ) : (
        <EmptyState icon={<Lock size={20} />} title="Disponible en el plan Enterprise" description="Las aplicaciones OAuth permiten que un proveedor actúe en nombre de tu agencia sin compartir claves. Mejora el plan desde Suscripción para usarlas." />
      )}
    </Card>
  );
}
