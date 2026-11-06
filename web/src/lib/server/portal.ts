import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { PortalSession } from "@/lib/portal";
import { getResource } from "./resource";

export const PORTAL_HOME = "/portal";

export async function portalData<T>(path: string, failure: string): Promise<T> {
  const data = await getResource<T>(`/portal${path}`, failure);
  if (!data) redirect(PORTAL_HOME);
  return data;
}

export const portalSession = cache(async (): Promise<PortalSession | null> => getResource<PortalSession>("/portal/session", "No pudimos abrir tu portal."));
