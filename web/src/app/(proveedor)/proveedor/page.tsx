import type { Metadata } from "next";
import { SupplierHomeView } from "@/features/supplier-portal/SupplierHomeView";
import type { SupplierHome } from "@/lib/supplier-portal";
import { supplierData, supplierSession } from "./data";

export const metadata: Metadata = { title: { absolute: "Inicio · Extranet" } };

export default async function SupplierHomePage() {
  const session = await supplierSession();
  if (!session) return null;
  const home = await supplierData<SupplierHome>("/home", "No pudimos cargar su inicio.");
  return <SupplierHomeView home={home} session={session} />;
}
