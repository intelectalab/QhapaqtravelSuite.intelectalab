import type { Metadata } from "next";
import { SupplierVouchersView } from "@/features/supplier-portal/SupplierVouchersView";
import type { SupplierVouchers } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Vouchers" };

export default async function SupplierVouchersPage() {
  const data = await supplierData<SupplierVouchers>("/vouchers", "No pudimos cargar sus vouchers.");
  return <SupplierVouchersView data={data} />;
}
