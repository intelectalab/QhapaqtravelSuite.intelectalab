import "server-only";
import { notFound, redirect } from "next/navigation";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

export const OUT_OF_PORTFOLIO = "SEC-BR-09";

export interface OutOfPortfolio {
  outOfPortfolio: string;
}

export function isOutOfPortfolio(value: unknown): value is OutOfPortfolio {
  return typeof value === "object" && value !== null && "outOfPortfolio" in value;
}

export async function getDetail<T>(path: string, failure: string): Promise<T | OutOfPortfolio> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403 && result.error?.code === OUT_OF_PORTFOLIO) return { outOfPortfolio: result.error.message };
  if (result.status === 404 || result.status === 403) notFound();
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? failure);
  return result.data;
}
