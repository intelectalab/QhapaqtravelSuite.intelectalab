import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { toClientDetail, toClientRow, type ApiClient, type ApiClientDetail, type ClientDetail, type ClientFormOptions, type ClientRow } from "@/lib/clients";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function crmGet<T>(path: string): Promise<{ data: T; today: string } | null> {
  const result = await apiFetch<{ data: T; meta: { today: string } }>(path, { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los clientes.");
  return { data: result.data.data, today: result.data.meta.today };
}

export async function listClients(): Promise<ClientRow[]> {
  const result = await crmGet<ApiClient[]>("/crm/clients");
  return result ? result.data.map((client) => toClientRow(client, result.today)) : [];
}

export const getClient = cache(async (code: string): Promise<ClientDetail> => {
  const result = await crmGet<ApiClientDetail>(`/crm/clients/${encodeURIComponent(code)}`);
  if (!result) notFound();
  return toClientDetail(result.data, result.today);
});

export const getClientFormOptions = cache(async (): Promise<ClientFormOptions> => {
  const result = await apiFetch<{ data: { segments: string[]; advisors: ClientFormOptions["advisors"]; can_reassign: boolean; can_manage: boolean } }>("/crm/clients/form-options", { raw: true });
  const data = result.ok ? result.data?.data : undefined;
  return { segments: data?.segments ?? [], advisors: data?.advisors ?? [], canReassign: data?.can_reassign ?? false, canManage: data?.can_manage ?? false };
});
