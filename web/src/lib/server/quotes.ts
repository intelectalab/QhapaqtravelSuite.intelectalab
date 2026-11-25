import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ExternalOfferState } from "@/lib/external-offers";
import type { QuoteAuditEvent, QuoteConversion, QuoteDetail, QuoteFormOptions, QuoteListMeta, QuoteRow } from "@/lib/quotes";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";
import { getDetail, type OutOfPortfolio } from "./detail";
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

export const getQuote = cache(async (code: string): Promise<QuoteDetail | OutOfPortfolio> => getDetail<QuoteDetail>(`/quotes/${encodeURIComponent(code)}`, "No pudimos cargar la cotización."));

export const getQuoteConversion = async (code: string): Promise<QuoteConversion | null> => get<QuoteConversion>(`/quotes/${encodeURIComponent(code)}/conversion-preview`);

export const getQuoteFormOptions = cache(async (): Promise<QuoteFormOptions | null> => get<QuoteFormOptions>("/quotes/form-options"));

export async function getQuoteActivity(code: string): Promise<QuoteAuditEvent[]> {
  const result = await fetchPages<QuoteAuditEvent>(`/quotes/${encodeURIComponent(code)}/activity`, 500);
  return result.ok && result.data ? result.data.data : [];
}

export async function getQuoteExternalOffers(code: string): Promise<{ data: ExternalOfferState | null; blocked: string | null }> {
  const result = await apiFetch<ExternalOfferState>(`/quotes/${encodeURIComponent(code)}/external-offers`);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 404) notFound();
  if (result.status === 403) return { data: null, blocked: result.error?.message ?? "Tu rol no puede ver las ofertas de aéreo y hotel." };
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las ofertas de aéreo y hotel.");
  return { data: result.data, blocked: null };
}
