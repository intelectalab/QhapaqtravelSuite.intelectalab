import type { BillingCycle, PlansCatalog, PublicPlan } from "@/lib/software";

export type SignupCycle = "mensual" | "anual" | "prueba";

export type LandingPlan = PublicPlan & { self_service: boolean; annual_months_paid: number; price_month_usd: number | null; price_year_usd: number | null };

export type LandingCatalog = Omit<PlansCatalog, "plans"> & {
  plans: LandingPlan[];
  fx: { currency: string; rate_pen: string; date: string; source: string } | null;
  igv_pct: number;
  trial: { days: number; card_required: boolean };
};

export interface SignupTotals {
  plan: string;
  plan_name: string;
  cycle: SignupCycle;
  months: number;
  months_paid: number;
  plan_price: string;
  addons: { code: string; label: string; quantity: number; amount: string }[];
  subtotal: string;
  coupon: string | null;
  discount: string;
  net: string;
  igv_pct: string;
  igv: string;
  total: string;
  currency: string;
  trial_days: number;
}

export interface Taxpayer {
  ruc: string;
  legal_name: string;
  address: string;
  city: string;
  status: string;
  active: boolean;
}

export interface SignupStatus {
  state: "prueba" | "pago_pendiente" | "pagada" | "fallida" | "abandonada";
  state_label: string;
  agency: string;
  tenant: string;
  plan: string | null;
  cycle: SignupCycle | null;
  doc_type: string | null;
  totals: SignupTotals | null;
  trial_ends_at: string | null;
  invoice: { number: string; status: string; total: string; paid_at: string | null } | null;
  payment: { method: string; qr?: string | null; expires_at?: string | null; label?: string | null; expired: boolean } | null;
  can_retry: boolean;
  poll_seconds: number | null;
  last_error: string | null;
  login_url: string;
  steps: { code: string; label: string; done: boolean }[];
}

export type PaymentMethod = "tarjeta" | "yape" | "plin" | "paypal";

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string>;
  code?: string;
}

export function signupHref(plan: Pick<PublicPlan, "code" | "rank">, cycle: BillingCycle | "trial"): string {
  if (plan.rank >= 3) return "/software/planes#ventas";
  const ciclo: SignupCycle = cycle === "trial" ? "prueba" : cycle === "year" ? "anual" : "mensual";
  return `/software/suscribirse?plan=${plan.code}&ciclo=${ciclo}`;
}

export const CYCLE_LABEL: Record<SignupCycle, string> = { mensual: "Mensual", anual: "Anual · pagas 10 meses", prueba: "Prueba de 14 días" };
