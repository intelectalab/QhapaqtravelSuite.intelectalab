import type { Metadata } from "next";
import { SupplierIncidentDetailView } from "@/features/supplier-portal/SupplierIncidentDetailView";
import type { SupplierIncidentDetail } from "@/lib/supplier-portal";
import { supplierData } from "../../data";

export async function generateMetadata({ params }: PageProps<"/proveedor/incidencias/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: code };
}

export default async function SupplierIncidentPage({ params }: PageProps<"/proveedor/incidencias/[code]">) {
  const { code } = await params;
  const detail = await supplierData<SupplierIncidentDetail>(`/incidents/${encodeURIComponent(code)}`, "No pudimos cargar la incidencia.");
  return <SupplierIncidentDetailView detail={detail} />;
}
