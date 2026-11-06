import type { Metadata } from "next";
import { SupplierPaymentsView } from "@/features/supplier-portal/SupplierPaymentsView";
import type { SupplierPayables } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Pagos" };

export default async function SupplierPaymentsPage() {
  const data = await supplierData<SupplierPayables>("/payables", "No pudimos cargar sus pagos.");
  return <SupplierPaymentsView data={data} />;
}
