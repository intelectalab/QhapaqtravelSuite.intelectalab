import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { PlanDetail, PlanSummary, PlatformMe, TenantDetail, TenantSummary } from "@/lib/platform";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

export async function platformGet<T>(path: string): Promise<T> {
  const result = await apiFetch<T>(`/platform${path}`, { realm: "platform" });
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.platform.mfaPage);
  if (result.status === 404) notFound();
  if (!result.ok || result.data === null) redirect(REALMS.platform.logout);
  return result.data;
}

export const currentPlatformUser = cache(() => platformGet<PlatformMe>("/me"));

export const listTenants = () => platformGet<TenantSummary[]>("/tenants");

export const getTenant = (code: string) => platformGet<TenantDetail>(`/tenants/${encodeURIComponent(code)}`);

export const listPlans = () => platformGet<PlanSummary[]>("/plans");

export const getPlan = cache((code: string) => platformGet<PlanDetail>(`/plans/${encodeURIComponent(code)}`));
