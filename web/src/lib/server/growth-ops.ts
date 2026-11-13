import "server-only";
import { notFound, redirect } from "next/navigation";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

export interface GrowthRead<T> {
  data: T | null;
  blocked: string | null;
}

export async function growthRead<T>(path: string, failure: string, raw = false): Promise<GrowthRead<T>> {
  const result = await apiFetch<T>(path, { raw });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return { data: null, blocked: result.error?.message ?? "Tu rol no tiene acceso a esta sección." };
  if (!result.ok || result.data === null) throw new Error(result.error?.message ?? failure);
  return { data: result.data, blocked: null };
}
