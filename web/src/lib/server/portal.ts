import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { parseGatewayInfo, type GatewayInfo } from "@/lib/payment-gateway";
import type { PortalSession } from "@/lib/portal";
import { getResource } from "./resource";

export const PORTAL_HOME = "/portal";

export async function portalData<T>(path: string, failure: string): Promise<T> {
  const data = await getResource<T>(`/portal/client${path}`, failure);
  if (!data) redirect(PORTAL_HOME);
  return data;
}

export async function passengerData<T>(path: string, failure: string): Promise<T | null> {
  return getResource<T>(`/portal/passenger${path}`, failure);
}

export const portalPaymentGateway = cache(async (): Promise<GatewayInfo> => parseGatewayInfo(await getResource<unknown>("/portal/client/payment-gateway", "No pudimos cargar la pasarela.")));

export const portalSession = cache(async (): Promise<PortalSession | null> => getResource<PortalSession>("/portal/client/session", "No pudimos abrir tu portal."));
