import { AppWindow } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { OAuthApps } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Aplicaciones OAuth" };

export default async function ApiOAuthPage() {
  const data = await getApiAccess();
  if (!data) return null;

  return (
    <Card>
      <TintCardTitle icon={AppWindow} title="Aplicaciones conectadas por OAuth" />
      <OAuthApps apps={data.apps} scopes={data.scopes} />
    </Card>
  );
}
