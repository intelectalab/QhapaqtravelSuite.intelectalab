import "server-only";
import { cache } from "react";
import type { EcommerceOverview, PromotionCatalog } from "@/lib/channels";
import { getResource } from "./resource";

export const getEcommerce = cache(async () => {
  const [overview, promotions] = await Promise.all([
    getResource<EcommerceOverview>("/channels/ecommerce", "No pudimos cargar el canal e-commerce."),
    getResource<PromotionCatalog>("/channels/ecommerce/promotions", "No pudimos cargar las promociones."),
  ]);
  return { overview, promotions };
});
