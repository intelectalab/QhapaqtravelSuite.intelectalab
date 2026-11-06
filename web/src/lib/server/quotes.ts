import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { QuoteConversion, QuoteDetail, QuoteFormOptions, QuoteList } from "@/lib/quotes";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las cotizaciones.");
  return result.data;
}

export const listQuotes = async (): Promise<QuoteList | null> => get<QuoteList>("/quotes");

export const getQuote = cache(async (code: string): Promise<QuoteDetail> => (await get<QuoteDetail>(`/quotes/${encodeURIComponent(code)}`)) ?? notFound());

export const getQuoteConversion = async (code: string): Promise<QuoteConversion | null> => get<QuoteConversion>(`/quotes/${encodeURIComponent(code)}/conversion`);

export const getQuoteFormOptions = cache(async (): Promise<QuoteFormOptions | null> => get<QuoteFormOptions>("/quotes/form-options"));
