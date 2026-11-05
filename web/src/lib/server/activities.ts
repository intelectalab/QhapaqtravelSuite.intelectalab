import "server-only";
import { redirect } from "next/navigation";
import type { Agenda, RelatedOptions } from "@/lib/activities";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar la agenda.");
  return result.data;
}

export const getAgenda = () => get<Agenda>("/crm/activities");

export const getRelatedOptions = () => get<RelatedOptions>("/crm/activities/related-options");
