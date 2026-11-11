import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { QuoteAuditEvent, QuoteConversion, QuoteDetail, QuoteFormOptions, QuoteListMeta, QuoteRow } from "@/lib/quotes";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";
import { type Collection, fetchPages } from "./pages";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las cotizaciones.");
  return result.data;
}

export async function listQuotes(): Promise<Collection<QuoteRow, QuoteListMeta> | null> {
  const result = await fetchPages<QuoteRow, QuoteListMeta>("/quotes", 1000);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las cotizaciones.");
  return result.data;
}

export const getQuote = cache(async (code: string): Promise<QuoteDetail> => (await get<QuoteDetail>(`/quotes/${encodeURIComponent(code)}`)) ?? notFound());

export const getQuoteConversion = async (code: string): Promise<QuoteConversion | null> => get<QuoteConversion>(`/quotes/${encodeURIComponent(code)}/conversion-preview`);

export const getQuoteFormOptions = cache(async (): Promise<QuoteFormOptions | null> => get<QuoteFormOptions>("/quotes/form-options"));

export async function getQuoteActivity(code: string): Promise<QuoteAuditEvent[]> {
  const result = await fetchPages<QuoteAuditEvent>(`/quotes/${encodeURIComponent(code)}/activity`, 500);
  return result.ok && result.data ? result.data.data : [];
}
