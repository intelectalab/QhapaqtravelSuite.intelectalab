import type { Metadata } from "next";
import { OseCatalogBoard } from "@/features/platform/FinanceIntegrations";
import { getOseCatalog } from "@/lib/server/platformFinance";

export const metadata: Metadata = { title: "Facturación electrónica" };

export default async function FacturacionElectronicaPage() {
  return <OseCatalogBoard data={await getOseCatalog()} />;
}
