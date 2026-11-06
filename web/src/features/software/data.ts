import "server-only";
import { cookies } from "next/headers";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "@/lib/server/api";
import type { DemoOptions, PlansCatalog, SoftwareOverview } from "@/lib/software";

async function publicResource<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(`/public/software/${path}`, { auth: false });
  return result.ok ? result.data : null;
}

export const getPlansCatalog = () => publicResource<PlansCatalog>("plans");

export const getOverview = () => publicResource<SoftwareOverview>("overview");

export const getDemoOptions = () => publicResource<DemoOptions>("demo-requests/options");

export async function hasAgencySession(): Promise<boolean> {
  return (await cookies()).has(REALMS.agency.session);
}
