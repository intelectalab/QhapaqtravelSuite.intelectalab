import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { REALMS } from "@/lib/realms";
import type { AiCreditsSummary, AiImage, AiJob, AiLedgerRow, AiOptions, AiPacksOverview } from "@/lib/siteTemplates";
import { apiFetch } from "./api";
import { getCachedResource } from "./resource";

export const getAiJobs = cache(async (): Promise<{ items: AiJob[]; options: AiOptions } | null> => {
  const result = await apiFetch<{ data: AiJob[]; meta: { options: AiOptions } }>("/cms/ai/jobs", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los pedidos de IA.");
  return { items: result.data.data, options: result.data.meta.options };
});

export const getAiCredits = () => getCachedResource<AiCreditsSummary>("/cms/ai/credits", "No pudimos cargar los créditos de IA.");

export const getAiImages = () => getCachedResource<AiImage[]>("/cms/ai/images", "No pudimos cargar las imágenes.");

export const getAiLedger = () => getCachedResource<AiLedgerRow[]>("/cms/ai/credits/ledger", "No pudimos cargar los movimientos de créditos.");

export const getAiPacks = () => getCachedResource<AiPacksOverview>("/cms/ai/packs", "No pudimos cargar los planes de IA.");
