export interface PricingRuleApplied {
  code: string;
  name: string;
  basis: string;
  adjust_pct: string;
}

export interface PricingApplied {
  season: { ref: string; name: string; factor: string; label: string } | null;
  dynamic: { pct: string; clamped: boolean; rules: PricingRuleApplied[]; label: string } | null;
}

export function pricingParts(pricing: PricingApplied | null | undefined): string[] {
  if (!pricing) return [];
  return [pricing.season ? `temporada ${pricing.season.label}` : null, pricing.dynamic ? `precio dinámico: ${pricing.dynamic.label}${pricing.dynamic.clamped ? ", con tope" : ""}` : null].filter((part): part is string => part !== null);
}

export function pricingText(pricing: PricingApplied | null | undefined): string {
  return pricingParts(pricing).join(" · ");
}
