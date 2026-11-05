import "server-only";
import { redirect } from "next/navigation";
import type { AccessInfo } from "@/lib/access";
import type { HomeDashboard, NavCounts } from "@/lib/dashboard";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

export async function getHomeDashboard(): Promise<HomeDashboard> {
  const result = await apiFetch<HomeDashboard>("/dashboard/home");
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar el panel de control.");
  return result.data;
}

export async function getNavCounts(): Promise<NavCounts> {
  const result = await apiFetch<NavCounts>("/me/counts");
  return result.ok && result.data ? result.data : {};
}

export async function getAccess(): Promise<AccessInfo | null> {
  const result = await apiFetch<AccessInfo>("/me/access");
  return result.ok && result.data ? result.data : null;
}
