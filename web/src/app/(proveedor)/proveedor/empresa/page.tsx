import type { Metadata } from "next";
import { SupplierCompanyView } from "@/features/supplier-portal/SupplierCompanyView";
import type { SupplierCompany } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Mi empresa" };

export default async function SupplierCompanyPage() {
  const data = await supplierData<SupplierCompany>("/company", "No pudimos cargar los datos de su empresa.");
  return <SupplierCompanyView data={data} />;
}
