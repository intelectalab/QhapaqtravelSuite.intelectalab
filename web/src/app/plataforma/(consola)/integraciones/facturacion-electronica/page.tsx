import type { Metadata } from "next";
import { OseCatalogBoard } from "@/features/platform/FinanceIntegrations";
import { FiscalWebhookCard } from "@/features/platform/FiscalWebhookCard";
import type { PlatformSettingsOverview } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";
import { getOseCatalog } from "@/lib/server/platformFinance";

export const metadata: Metadata = { title: "Facturación electrónica" };

export default async function FacturacionElectronicaPage() {
  const [catalog, settings] = await Promise.all([getOseCatalog(), platformGet<PlatformSettingsOverview>("/settings")]);

  return (
    <div className="flex flex-col gap-5">
      <OseCatalogBoard data={catalog} />
      <FiscalWebhookCard webhook={settings.sections.fiscal_webhook} version={settings.lock_version} index={1} />
    </div>
  );
}
