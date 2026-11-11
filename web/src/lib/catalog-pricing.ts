export interface PriceRule {
  ref: string;
  name: string;
  kind: string;
  value: number;
  scope: string;
  channel: string | null;
  min_pax: number | null;
  residency: "dom" | "nodom" | null;
  product: { id: string; code: string; name: string } | null;
  currency: string | null;
  priority: number;
  status: "activa" | "inactiva";
}

export interface PricingOverview {
  today: string;
  rules: PriceRule[];
  options: {
    kinds: string[];
    channels: string[];
    currencies: string[];
    products: { id: string; code: string; name: string; status: string }[];
    rates: { id: string; ref: string; product_id: string; rate_type: string; segment: string; channel: string; currency: string; cost: number; valid_from: string; valid_to: string }[];
  };
  can: { manage: boolean };
}

export interface PricingStep {
  id: string;
  label: string;
  amount: number;
  note: string | null;
  rule: string | null;
  total?: boolean;
}

export interface PricingResult {
  currency: string;
  rate: { ref: string; valid_from: string; valid_to: string; in_range: boolean };
  product: { code: string; name: string; active: boolean };
  season: { ref: string; name: string; factor: number } | null;
  steps: PricingStep[];
  unit_price: number;
  commission: { amount: number; pct: number; rule: string | null };
  profit: number;
  margin_pct: number;
  limit: { rule: string; kind: "minimo" | "maximo"; value: number } | null;
  applied: string[];
}

export const RESIDENCY_LABEL: Record<"dom" | "nodom", string> = { dom: "Domiciliado", nodom: "No domiciliado" };

export const PERCENT_KINDS = ["Markup %", "Descuento %", "Impuesto %", "Comisión %"];

export function ruleValue(rule: Pick<PriceRule, "kind" | "value" | "currency">): string {
  if (PERCENT_KINDS.includes(rule.kind)) return `${rule.value.toLocaleString("es-PE", { maximumFractionDigits: 2 })} %`;
  if (rule.kind === "Redondeo") return `a ${rule.value.toLocaleString("es-PE", { maximumFractionDigits: 2 })}`;
  return `${rule.currency ?? ""} ${rule.value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}
