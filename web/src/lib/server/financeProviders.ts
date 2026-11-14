import "server-only";
import { redirect } from "next/navigation";
import type { FxProvidersData } from "@/features/finance/FxRates";
import type { AgencyOse } from "@/lib/financeProviders";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";
import { getResource } from "./resource";

export async function getFxProviders(): Promise<FxProvidersData | null> {
  const result = await apiFetch<{ data: FxProvidersData["providers"]; meta: Omit<FxProvidersData, "providers"> }>("/finance/fx-providers", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (!result.ok || !result.data) return null;
  return { ...result.data.meta, providers: result.data.data };
}

export const getAgencyOse = () => getResource<AgencyOse>("/finance/ose", "No pudimos cargar el estado de la facturación electrónica.");
