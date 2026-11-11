import type { Metadata } from "next";
import { SupplierRoomingView } from "@/features/supplier-portal/SupplierRoomingView";
import type { SupplierRooming } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Rooming lists" };

export default async function SupplierRoomingPage() {
  const data = await supplierData<SupplierRooming>("/rooming-lists", "No pudimos cargar sus rooming lists.");
  return <SupplierRoomingView data={data} />;
}
