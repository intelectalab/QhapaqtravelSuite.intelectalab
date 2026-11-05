import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { OpportunityBoard, OpportunityDetail } from "@/lib/opportunities";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las oportunidades.");
  return result.data;
}

export async function getBoard(): Promise<OpportunityBoard | null> {
  return get<OpportunityBoard>("/crm/opportunities");
}

export const getOpportunity = cache(async (code: string): Promise<OpportunityDetail> => (await get<OpportunityDetail>(`/crm/opportunities/${encodeURIComponent(code)}`)) ?? notFound());
