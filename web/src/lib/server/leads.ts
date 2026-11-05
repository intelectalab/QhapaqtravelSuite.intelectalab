import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { CrmCatalogs, LeadDetail, LeadRow } from "@/lib/leads";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function leadGet<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los leads.");
  return result.data;
}

export async function listLeads(): Promise<LeadRow[]> {
  return (await leadGet<LeadRow[]>("/crm/leads")) ?? [];
}

export const getLead = cache(async (code: string): Promise<LeadDetail> => {
  return (await leadGet<LeadDetail>(`/crm/leads/${encodeURIComponent(code)}`)) ?? notFound();
});

export const getCatalogs = cache(async (): Promise<CrmCatalogs | null> => leadGet<CrmCatalogs>("/crm/catalogs"));
