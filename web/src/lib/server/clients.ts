import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { toClientDetail, toClientRow, type ApiClient, type ApiClientDetail, type ClientDetail, type ClientRow } from "@/lib/clients";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function crmGet<T>(path: string): Promise<{ data: T; today: string }> {
  const result = await apiFetch<{ data: T; meta: { today: string } }>(path, { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los clientes.");
  return { data: result.data.data, today: result.data.meta.today };
}

export async function listClients(): Promise<ClientRow[]> {
  const { data, today } = await crmGet<ApiClient[]>("/crm/clients");
  return data.map((client) => toClientRow(client, today));
}

export const getClient = cache(async (code: string): Promise<ClientDetail> => {
  const { data, today } = await crmGet<ApiClientDetail>(`/crm/clients/${encodeURIComponent(code)}`);
  return toClientDetail(data, today);
});
