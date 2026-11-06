import "server-only";
import { redirect } from "next/navigation";
import type { AuditEvent, BillingOverview, Coupon, DunningOverview, FlagsOverview, InvoiceFull, InvoiceSummary, OperationsOverview, PlatformHomeOverview, TrialsOverview, UsageOverview } from "@/lib/platformBilling";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";
import { fetchPages } from "./pages";
import { platformGet } from "./platform";

export const getPlatformHome = () => platformGet<PlatformHomeOverview>("/home");

export const getBillingOverview = () => platformGet<BillingOverview>("/metrics");

export const listPlatformInvoices = () => platformGet<InvoiceSummary[]>("/invoices");

export const getPlatformInvoice = (id: string) => platformGet<InvoiceFull>(`/invoices/${encodeURIComponent(id)}`);

export const getDunning = () => platformGet<DunningOverview>("/dunning");

export const getTrials = () => platformGet<TrialsOverview>("/trials");

export const listCoupons = () => platformGet<Coupon[]>("/coupons");

export const getFlags = () => platformGet<FlagsOverview>("/features");

export const getUsage = () => platformGet<UsageOverview>("/usage");

export const getOperations = () => platformGet<OperationsOverview>("/operations");

export async function listPlatformAudit(): Promise<AuditEvent[]> {
  const result = await fetchPages<AuditEvent>("/platform/audit-events", 500, "platform");
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.platform.mfaPage);
  if (!result.ok || !result.data) redirect(REALMS.platform.logout);
  return result.data.data;
}

export interface ConsoleResult {
  message: string | null;
  done: boolean;
  notice?: string | null;
}

export async function platformSend<T = unknown>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string, notice?: (data: T | null) => string | null): Promise<ConsoleResult> {
  const result = await apiFetch<T>(`/platform${path}`, { method, body, realm: "platform" });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? failure, done: false };
  }
  return { message: null, done: true, notice: notice?.(result.data) ?? null };
}
