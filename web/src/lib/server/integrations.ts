import "server-only";
import { cache } from "react";
import type { AgencyMailSummary, IntegrationReadiness } from "@/lib/integrations";
import { apiFetch } from "./api";

export const getReadiness = cache(async (): Promise<IntegrationReadiness | null> => {
  const result = await apiFetch<IntegrationReadiness>("/integrations/readiness");
  return result.ok && result.data ? result.data : null;
});

export async function getAgencyMail(): Promise<AgencyMailSummary | null> {
  const result = await apiFetch<AgencyMailSummary>("/settings/outgoing-mail");
  return result.ok && result.data ? result.data : null;
}
