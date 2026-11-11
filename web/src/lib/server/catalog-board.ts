import "server-only";
import { cache } from "react";
import type { AvailabilityOverview } from "@/lib/catalog-availability";
import type { DeparturesOverview } from "@/lib/catalog-departures";
import type { PricingOverview } from "@/lib/catalog-pricing";
import type { RatesOverview } from "@/lib/catalog-rates";
import { getResource } from "./resource";

export const getDepartures = cache(async () => {
  const [departures, availability] = await Promise.all([
    getResource<DeparturesOverview>("/catalog/departures", "No pudimos cargar las salidas."),
    getResource<AvailabilityOverview>("/catalog/availability", "No pudimos cargar los bloqueos."),
  ]);
  return { departures, availability };
});

export const getRates = cache(async () => getResource<RatesOverview>("/catalog/rates", "No pudimos cargar las tarifas."));

export const getPricing = cache(async () => getResource<PricingOverview>("/catalog/price-rules", "No pudimos cargar las reglas de pricing."));
