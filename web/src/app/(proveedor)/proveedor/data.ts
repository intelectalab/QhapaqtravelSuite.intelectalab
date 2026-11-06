import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupplierSession } from "@/lib/supplier-portal";
import { getResource } from "@/lib/server/resource";

export const SUPPLIER_HOME = "/proveedor";

export async function supplierData<T>(path: string, failure: string): Promise<T> {
  const data = await getResource<T>(`/supplier${path}`, failure);
  if (!data) redirect(SUPPLIER_HOME);
  return data;
}

export const supplierSession = cache(async (): Promise<SupplierSession | null> => getResource<SupplierSession>("/supplier/session", "No pudimos abrir la extranet."));
