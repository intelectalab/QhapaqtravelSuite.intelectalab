import type { Metadata } from "next";
import { SupplierIncidentsView } from "@/features/supplier-portal/SupplierIncidentsView";
import type { SupplierIncidents } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Incidencias" };

export default async function SupplierIncidentsPage() {
  const data = await supplierData<SupplierIncidents>("/incidents", "No pudimos cargar sus incidencias.");
  return <SupplierIncidentsView data={data} />;
}
