import type { Metadata } from "next";
import { FxCatalogBoard } from "@/features/platform/FinanceIntegrations";
import { getFxCatalog } from "@/lib/server/platformFinance";

export const metadata: Metadata = { title: "Tipo de cambio" };

export default async function TipoDeCambioPage() {
  return <FxCatalogBoard data={await getFxCatalog()} />;
}
