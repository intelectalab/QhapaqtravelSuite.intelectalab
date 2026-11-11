import "server-only";
import { cache } from "react";
import type { AllotmentDetail, AllotmentsOverview } from "@/lib/catalog-allotments";
import { getResource } from "./resource";

export const getAllotments = cache(async () => getResource<AllotmentsOverview>("/catalog/allotments", "No pudimos cargar los cupos."));

export const getAllotment = cache(async (code: string) => getResource<AllotmentDetail>(`/catalog/allotments/${encodeURIComponent(code)}`, "No pudimos cargar el contrato de cupo."));
