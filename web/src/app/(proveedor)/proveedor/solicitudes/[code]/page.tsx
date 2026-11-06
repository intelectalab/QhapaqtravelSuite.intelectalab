import type { Metadata } from "next";
import { SupplierRequestDetailView } from "@/features/supplier-portal/SupplierRequestDetailView";
import type { SupplierRequestDetail } from "@/lib/supplier-portal";
import { supplierData } from "../../data";

export async function generateMetadata({ params }: PageProps<"/proveedor/solicitudes/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: code };
}

export default async function SupplierRequestPage({ params }: PageProps<"/proveedor/solicitudes/[code]">) {
  const { code } = await params;
  const detail = await supplierData<SupplierRequestDetail>(`/requests/${encodeURIComponent(code)}`, "No pudimos cargar la solicitud.");
  return <SupplierRequestDetailView detail={detail} />;
}
