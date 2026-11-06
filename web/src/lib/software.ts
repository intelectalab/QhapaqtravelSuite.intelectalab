import { FileText, Filter, Luggage, Target, Truck, Wallet, type LucideIcon } from "lucide-react";
import { NAV_GROUPS, type NavGroup } from "@/config/navigation";
import type { PlanMetric } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

export type BillingCycle = "month" | "year";

export interface PublicPlan {
  code: string;
  name: string;
  rank: number;
  price_month: number;
  price_year: number;
  currency: string;
  trial_days: number;
  support_level: string | null;
  saving_year: number;
  saving_percent: number;
  modules: number;
  previous: string | null;
  highlights: string[];
  limits: Partial<Record<PlanMetric, number | null>>;
  agencies: number;
  rules_included: number;
  rules_total: number;
}

export interface PlanFeatureRow {
  key: string;
  label: string;
  kind: "module" | "limit";
  addon: string | null;
  values: Record<string, string | null>;
}

export interface PlanFeatureGroup {
  group: string;
  items: PlanFeatureRow[];
}

export type AddonStatus = "included" | "available" | "unavailable";

export interface PublicAddon {
  code: string;
  label: string;
  unit: string | null;
  quantity_allowed: boolean;
  plans: Record<string, { status: AddonStatus; price: number | null }>;
}

export interface PublicRule {
  code: string;
  group: string;
  name: string;
  description: string;
  from: string | null;
  rank: number;
}

export interface PlansCatalog {
  currency: string;
  plans: PublicPlan[];
  features: PlanFeatureGroup[];
  addons: PublicAddon[];
  rules: { group: string; rules: PublicRule[] }[];
}

export interface SoftwareOverview {
  agencies: { live: number; active: number; cities: number };
  segments: { type: string; agencies: number; plan: string | null; plan_name: string | null; plan_rank: number | null }[];
  funnel: Record<FunnelStep, number>;
  reservations: Record<string, number>;
  catalog: { products: number; rules: number; features: number; plans: number };
}

export type FunnelStep = "leads" | "opportunities" | "quotes" | "reservations" | "operations" | "payments";

export interface FunnelInfo {
  key: FunnelStep;
  label: string;
  stage: string;
  text: string;
  icon: LucideIcon;
  tone: Tone;
  href: string;
}

export const FUNNEL_STEPS: FunnelInfo[] = [
  { key: "leads", label: "Leads", stage: "Captar", text: "Consultas de WhatsApp, web y redes en una sola bandeja, asignadas al asesor correcto.", icon: Filter, tone: "t3", href: "/crm/leads" },
  { key: "opportunities", label: "Oportunidades", stage: "Calificar", text: "Embudo por etapas con fechas, presupuesto y próximos pasos de cada viaje.", icon: Target, tone: "t2", href: "/crm/oportunidades" },
  { key: "quotes", label: "Cotizaciones", stage: "Cotizar", text: "Versiones, márgenes y aprobación interna antes de enviar el enlace al cliente.", icon: FileText, tone: "t1", href: "/cotizaciones" },
  { key: "reservations", label: "Reservas", stage: "Reservar", text: "La cotización aprobada se vuelve reserva con pasajeros, cupos y cuotas.", icon: Luggage, tone: "t4", href: "/reservas" },
  { key: "operations", label: "Órdenes operativas", stage: "Operar", text: "Proveedores, guías y movilidad confirmados, con vouchers y rooming list.", icon: Truck, tone: "violet", href: "/operaciones/ordenes" },
  { key: "payments", label: "Pagos", stage: "Cobrar", text: "Cobros aplicados a cada cuota, comprobantes y caja conciliada con el banco.", icon: Wallet, tone: "ok", href: "/finanzas/pagos" },
];

export interface DemoOptions {
  business_types: string[];
  team_sizes: string[];
  plans: { code: string; name: string; trial_days: number }[];
}

export type DemoKind = "demo" | "trial";

export interface DemoFormState {
  message: string | null;
  done: boolean;
  code: string | null;
  errors: Record<string, string>;
  values: Record<string, string>;
}

export const DEMO_INITIAL: DemoFormState = { message: null, done: false, code: null, errors: {}, values: {} };

export const SITE_LINKS = [
  { href: "/software/modulos", label: "Módulos" },
  { href: "/software/planes", label: "Planes" },
  { href: "/software/agencias", label: "Agencias" },
  { href: "/software/contacto", label: "Contacto" },
];

export interface ModuleArea {
  id: string;
  title: string;
  pitch: string;
  tone: Tone;
  groups: NavGroup[];
}

const AREAS: { id: string; title: string; pitch: string; tone: Tone; groups: string[] }[] = [
  { id: "vender", title: "Vender", pitch: "Captura cada consulta, cotiza con versiones y convierte la aprobación en reserva sin volver a digitar.", tone: "t3", groups: ["crm", "marketing", "ventas"] },
  { id: "producto", title: "Diseñar el producto", pitch: "Tours, paquetes, tarifas por temporada, salidas y cupos en un catálogo que todo el equipo comparte.", tone: "t4", groups: ["catalogo"] },
  { id: "operar", title: "Operar el viaje", pitch: "Órdenes a proveedores, guías y movilidad asignados, vouchers y documentos listos para cada pasajero.", tone: "t1", groups: ["operaciones", "movil"] },
  { id: "cobrar", title: "Cobrar y rendir", pitch: "Cuotas, pagos, comprobantes, comisiones y caja conciliada con el banco, con la rentabilidad de cada reserva.", tone: "t2", groups: ["finanzas"] },
  { id: "distribuir", title: "Vender en todos los canales", pitch: "Agencias aliadas, tienda en línea, sitio web y portales para clientes y pasajeros.", tone: "violet", groups: ["canales"] },
  { id: "dirigir", title: "Dirigir la agencia", pitch: "Panel, aprobaciones, reportes, permisos por rol y auditoría de cada cambio.", tone: "info", groups: ["general", "inteligencia", "admin"] },
];

export const MODULE_AREAS: ModuleArea[] = AREAS.map((area) => ({
  ...area,
  groups: area.groups.map((id) => NAV_GROUPS.find((group) => group.id === id)).filter((group): group is NavGroup => group !== undefined),
}));

export const MODULE_SCREEN_COUNT = NAV_GROUPS.reduce((total, group) => total + group.screens.length, 0);

export function monthlyPrice(plan: Pick<PublicPlan, "price_month" | "price_year">, cycle: BillingCycle): number {
  return cycle === "year" ? plan.price_year / 12 : plan.price_month;
}

export function featuredPlan(plans: PublicPlan[]): PublicPlan | undefined {
  return [...plans].sort((a, b) => b.agencies - a.agencies || a.rank - b.rank)[0];
}

export function maxSaving(plans: PublicPlan[]): number {
  return plans.reduce((best, plan) => Math.max(best, plan.saving_percent), 0);
}

export function trialDays(plans: PublicPlan[]): number {
  return plans.reduce((best, plan) => Math.max(best, plan.trial_days), 0);
}

export function contactHref(kind: DemoKind, plan?: string, cycle?: BillingCycle): string {
  const params = new URLSearchParams({ tipo: kind === "trial" ? "prueba" : "demo" });
  if (plan) params.set("plan", plan);
  if (cycle) params.set("ciclo", cycle === "year" ? "anual" : "mensual");
  return `/software/contacto?${params.toString()}`;
}
