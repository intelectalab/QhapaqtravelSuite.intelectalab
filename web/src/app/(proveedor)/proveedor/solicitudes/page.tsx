import type { Metadata } from "next";
import { SupplierRequestsView } from "@/features/supplier-portal/SupplierRequestsView";
import type { SupplierCompany, SupplierRequests } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function SupplierRequestsPage() {
  const [data, company] = await Promise.all([supplierData<SupplierRequests>("/requests", "No pudimos cargar las solicitudes."), supplierData<SupplierCompany>("/company", "No pudimos cargar los datos de su empresa.")]);
  return <SupplierRequestsView data={data} contact={company.provider.contact} />;
}
