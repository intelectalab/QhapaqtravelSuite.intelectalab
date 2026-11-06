import "server-only";
import { cache } from "react";
import type { AgencySession } from "@/lib/b2b-portal";
import { getResource } from "./resource";

export const agencySession = cache(async (): Promise<AgencySession | null> => getResource<AgencySession>("/b2b/session", "No pudimos abrir el portal de tu agencia."));

export async function agencyData<T>(path: string, failure: string): Promise<T | null> {
  if (!(await agencySession())) return null;
  return getResource<T>(`/b2b${path}`, failure);
}
