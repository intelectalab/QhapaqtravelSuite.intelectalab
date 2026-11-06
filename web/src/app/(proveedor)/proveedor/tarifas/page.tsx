import type { Metadata } from "next";
import { SupplierRatesView } from "@/features/supplier-portal/SupplierRatesView";
import type { SupplierRates } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Tarifas" };

export default async function SupplierRatesPage() {
  const data = await supplierData<SupplierRates>("/rates", "No pudimos cargar sus tarifas.");
  return <SupplierRatesView data={data} />;
}
