import type { DepartureRow } from "./catalog-departures";
import type { Tone } from "./tone";

export type ProductStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";

export interface ProductRow {
  code: string;
  name: string;
  lock_version: number;
  type: string;
  category: string;
  subcategory: string | null;
  destination: string;
  destination_path: string;
  duration: { value: number; unit: string };
  modality: string;
  status: ProductStatus;
  channels: string[];
  featured: boolean;
  price_from?: { amount: string; currency: string; segment?: string; channel?: string } | null;
}

export interface ProductDetail extends ProductRow {
  internal_name: string;
  lock_version: number;
  ids: { type: string; category: string; subcategory: string | null; destination: string; provider: string | null };
  raw: { is_b2b: boolean; is_ecommerce: boolean; availability_model: string; markup_pct: number | null };
  sku: string;
  short_description: string | null;
  long_description: string | null;
  pax: { min: number; max: number };
  age: { min: number; max: number };
  advance_days: { min: number; max: number };
  markup_pct: string | null;
  provider: { name: string; type: string; phone: string | null } | null;
  itinerary: { day: number; title: string; items: { time: string | null; activity: string; type: string | null; location: string | null }[] }[];
  includes: string[];
  excludes: string[];
  requirements: string[];
  policies: { cancellation: string; modification: string; no_show: string; refund: string; penalties: string | null; advance_min: string | null; advance_max: string | null; penalty_tiers: PenaltyTier[] } | null;
  rates: { ref: string; type: string; segment: string; channel: string; currency: string; basis: string; price: string; cost: string | null; margin_pct: number | null; valid_from: string; valid_to: string; active: boolean }[];
}

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "info" },
  REVIEW: { label: "En revisión", tone: "sun" },
  APPROVED: { label: "Aprobado", tone: "accent" },
  ACTIVE: { label: "Activo", tone: "ok" },
  SUSPENDED: { label: "Suspendido", tone: "bad" },
  INACTIVE: { label: "Inactivo", tone: "mute" },
  ARCHIVED: { label: "Archivado", tone: "mute" },
};

export function durationLabel(duration: ProductRow["duration"]): string {
  const value = Number.isInteger(duration.value) ? duration.value : duration.value.toFixed(1);
  const unit = duration.value === 1 ? duration.unit.replace(/s$/, "").replace(/día$/, "día") : duration.unit;
  return `${value} ${unit}`;
}

export interface ProductFormOptions {
  types: { id: string; name: string; requires_itinerary: boolean; requires_components: boolean }[];
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  destinations: { id: string; name: string; path: string; level: number }[];
  providers: { id: string; name: string; type: string; blocked: string | null }[];
  services: { id: string; ref: string; name: string; type: string; unit: string; cost: string | null; currency: string; provider_id: string; provider: string; valid_to?: string; blocked: string | null }[];
  products: { id: string; code: string; name: string }[];
  seasons: { id: string; ref: string; name: string; type: string; date_from: string; date_to: string; priority: number; factor: string; status: string }[];
  units: string[];
  modalities: string[];
  availability: string[];
  availability_sources: string[];
  item_types: string[];
  requirement_categories: string[];
  destination_types: string[];
  season_types: string[];
  channels: string[];
  rates: { types: string[]; segments: string[]; channels: string[]; bases: string[]; currencies: string[] };
  defaults: { policies: Partial<Record<"cancellation" | "modification" | "no_show" | "refund" | "penalties" | "date_change", string>> & { penalty_tiers?: PenaltyTier[] }; exclusions: string[] };
  today: string;
  can_create: boolean;
  can_update: boolean;
  can_activate: boolean;
  can_manage_rates: boolean;
  can_publish: boolean;
  can_manage_destinations: boolean;
  sees_cost: boolean;
  sees_margin: boolean;
}

export interface ProductMaster {
  name: string;
  internal_name: string;
  code: string;
  sku: string;
  type_id: string;
  category_id: string;
  subcategory_id: string;
  destination_id: string;
  short_description: string;
  duration_value: number;
  duration_unit: string;
  modality: string;
  minimum_passengers: number;
  maximum_passengers: number;
  minimum_age: number;
  maximum_age: number;
  booking_advance_min_days: number;
  booking_advance_max_days: number;
  is_bookable: boolean;
  is_quoteable: boolean;
  is_b2b: boolean;
  is_ecommerce: boolean;
  is_featured: boolean;
  markup_pct: number | null;
}

export interface ProductComponentDraft {
  id?: string;
  service_id: string | null;
  component_product_id: string | null;
  quantity: number;
  is_required: boolean;
  is_included: boolean;
  notes: string | null;
  subtotal_pen?: string | null;
  unit_cost?: string | null;
  cost_currency?: string | null;
}

export interface ItineraryDayDraft {
  id?: string;
  title: string;
  items: ItineraryItemDraft[];
}

export interface ItineraryItemDraft {
  id?: string;
  time: string | null;
  activity: string;
  type: string | null;
  location: string | null;
  service_id?: string | null;
  service?: string | null;
  note?: string | null;
  image_ref?: string | null;
  cost?: string | null;
  price?: string | null;
}

export interface ProductRateDraft {
  ref?: string;
  rate_type: string;
  segment: string;
  channel: string;
  currency: string;
  price_basis: string;
  cost: string | null;
  price: string;
  min_price?: string | null;
  max_price?: string | null;
  conditions?: string | null;
  margin_pct?: number | null;
  valid_from: string;
  valid_to: string;
  season_id: string | null;
  state?: string;
  lock_version?: number;
}

export interface ProductContentDraft {
  long_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  slug: string | null;
  video_url: string | null;
  features?: string[];
  inclusions: string[];
  exclusions: string[];
  requirements: { category: string | null; text: string }[];
  faqs: { question: string; answer: string }[];
  media: { url: string; alt_text: string; is_main: boolean }[];
}

export interface PenaltyTier {
  min_days: number;
  pct: number;
}

export interface ProductPoliciesDraft {
  cancellation: string;
  modification: string;
  no_show: string;
  refund: string;
  penalties: string | null;
  date_change: string | null;
  penalty_tiers: PenaltyTier[];
  tiers_from_text?: boolean;
}

export function sortTiers(tiers: PenaltyTier[]): PenaltyTier[] {
  const unique = new Map<number, PenaltyTier>();
  for (const tier of tiers) {
    if (Number.isFinite(tier.min_days) && Number.isFinite(tier.pct)) unique.set(tier.min_days, tier);
  }
  return [...unique.values()].sort((a, b) => b.min_days - a.min_days);
}

export function tierRanges(tiers: PenaltyTier[]): { label: string; pct: number }[] {
  const rows: { label: string; pct: number }[] = [];
  let upper: number | null = null;
  for (const tier of sortTiers(tiers)) {
    const label =
      upper === null ? (tier.min_days === 0 ? "En cualquier momento" : `${tier.min_days} días o más`) : tier.min_days === 0 && upper === 1 ? "El mismo día" : tier.min_days === 0 ? `Menos de ${upper} días` : tier.min_days === upper - 1 ? `${tier.min_days} días` : `${tier.min_days} a ${upper - 1} días`;
    rows.push({ label, pct: tier.pct });
    upper = tier.min_days;
  }
  if (upper !== null && upper > 0) rows.push({ label: `Menos de ${upper} días`, pct: 100 });
  return rows;
}

export interface CostBreakdown {
  items: { name: string; amount: string; per_person: boolean }[];
  per_person: string;
  shared: string;
  min_pax: number;
  max_pax: number;
  price: string | null;
  break_even: number | null;
  loses_at_min: boolean;
  groups: { pax: number; shared_share: string; cost: string; profit: string | null; margin_pct: string | null }[];
}

export interface ProductReview {
  summary: { name: string; code: string; sku: string; type: string | null; category: string | null; subcategory: string | null; destination: string | null; provider: string | null; components: number; components_cost: string | null; cost_breakdown: CostBreakdown | null; itinerary_days: number; rates: number; seasons: number; availability: string; status: ProductStatus };
  checklist: { items: ChecklistItem[]; passed: number; total: number };
}

export interface ProductDraft {
  master: ProductMaster;
  secondary_destination_ids: string[];
  main_provider_id: string | null;
  components: ProductComponentDraft[];
  itinerary: ItineraryDayDraft[];
  rates: ProductRateDraft[];
  season_ids: string[];
  availability: { model: string; capacity: number | null; source: string };
  content: ProductContentDraft;
  policies: ProductPoliciesDraft;
  channels: string[];
}

export interface ProductEditorState extends ProductDraft {
  itinerary_id: string | null;
  fx_usd: string | null;
  code: string;
  ref: string;
  status: ProductStatus;
  lock_version: number;
  review: ProductReview;
}

export const PRODUCT_STEPS = ["Definir", "Categorizar", "Destino", "Componentes", "Itinerario", "Tarifas", "Temporadas", "Disponibilidad", "Contenido", "Publicar"] as const;

export const AVAILABILITY_HINT: Record<string, string> = {
  SIN_CONTROL: "Se vende sin validar cupos; Operaciones confirma con el proveedor.",
  CUPOS: "Cupos por día cargados en rangos de disponibilidad.",
  CAPACIDAD: "Capacidad fija por servicio u operación.",
  POR_PROVEEDOR: "La disponibilidad la confirma el proveedor en cada venta.",
  POR_ACTIVIDAD: "Cupo propio de cada actividad del programa.",
  POR_TRANSPORTE: "Limitado por los asientos del transporte.",
  POR_HABITACION: "Limitado por las habitaciones del alojamiento.",
  POR_SALIDA: "Se vende sobre salidas programadas con cupo; necesita una salida abierta para activarse.",
  POR_FECHA: "Fechas habilitadas una por una en el calendario.",
};

export const CHANNEL_INFO: Record<string, { label: string; hint: string }> = {
  erp: { label: "ERP", hint: "Gestión interna del catálogo y la operación. Siempre activo." },
  crm: { label: "CRM", hint: "Recomendaciones en oportunidades y en la ficha del cliente." },
  quotes: { label: "Cotizaciones", hint: "Seleccionable en el cotizador por Ventas." },
  b2b: { label: "B2B", hint: "Visible para agencias asociadas con su lista de precios." },
  portal: { label: "Portal cliente", hint: "Visible en el portal de autoservicio del cliente." },
  portal_pax: { label: "Portal pasajero", hint: "Itinerario y documentos del viaje del pasajero." },
  cms: { label: "CMS", hint: "Ficha publicable en el sitio web." },
  ecommerce: { label: "E-commerce", hint: "Compra en línea con pasarela de pagos." },
  mobile: { label: "Mobile", hint: "Apps de operador y pasajero." },
};

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string | null;
}

export const AVAILABILITY_LABEL: Record<string, string> = {
  SIN_CONTROL: "Sin control de cupos",
  CUPOS: "Cupos por día",
  CAPACIDAD: "Capacidad fija",
  POR_PROVEEDOR: "Según el proveedor",
  POR_ACTIVIDAD: "Por actividad",
  POR_TRANSPORTE: "Por transporte",
  POR_HABITACION: "Por habitación",
  POR_SALIDA: "Por salida programada",
  POR_FECHA: "Por fecha",
};

export const LIFECYCLE: { action: string; label: string; from: ProductStatus[]; reason: boolean; activate: boolean; primary?: boolean; description: string }[] = [
  { action: "submit-review", label: "Enviar a revisión", from: ["DRAFT"], reason: false, activate: false, primary: true, description: "Gerencia lo revisa antes de aprobarlo. Mientras tanto se puede seguir completando." },
  { action: "approve", label: "Aprobar", from: ["REVIEW"], reason: false, activate: true, primary: true, description: "Queda listo para activarse cuando cumpla el checklist." },
  { action: "return-to-draft", label: "Devolver", from: ["REVIEW"], reason: true, activate: true, description: "Vuelve a borrador para que lo corrijan. Explica qué falta." },
  { action: "activate", label: "Activar", from: ["APPROVED", "SUSPENDED", "INACTIVE"], reason: false, activate: true, primary: true, description: "Se podrá cotizar y vender. Antes revisamos los 12 requisitos del checklist." },
  { action: "suspend", label: "Suspender", from: ["ACTIVE"], reason: true, activate: true, description: "Deja de venderse por un tiempo. Ventas recibe el aviso." },
  { action: "deactivate", label: "Inactivar", from: ["ACTIVE", "SUSPENDED"], reason: true, activate: true, description: "Deja de venderse hasta que alguien lo vuelva a activar." },
  { action: "archive", label: "Archivar", from: ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "SUSPENDED", "INACTIVE"], reason: true, activate: true, description: "Sale del catálogo de forma definitiva. Su historial se conserva." },
];

export interface ProductTranslationText {
  name: string | null;
  short: string | null;
  long: string | null;
  inclusions: string[];
  exclusions: string[];
  seo_title: string | null;
  seo_description: string | null;
}

export interface ProductTranslations {
  code: string;
  base: ProductTranslationText & { locale: string };
  translations: (ProductTranslationText & { locale: string; exists: boolean; slug: string | null; updated_at: string | null })[];
}

export interface RelatedProduct {
  code: string;
  name: string;
  status: ProductStatus;
  relation: string;
  type: string;
  price_from: { amount: string; currency: string } | null;
}

export interface ProductOverview {
  code: string;
  kpis: { components_cost: string | null; cost_breakdown: CostBreakdown | null; future_departures: number; quotes: number; reservations: number; sellable: boolean; version: string | null };
  checklist: ProductReview["checklist"];
  departures: (Omit<DepartureRow, "time"> & { time: string | null })[];
  providers: { ref: string; name: string; type: string; status: string; contract_end: string; contract_days: number; ruc: string; payment_terms: string | null; rating: number; main: boolean; services: string[]; usable: boolean }[] | null;
  related: RelatedProduct[];
  referenced_by: RelatedProduct[];
  b2b: { agency_code: string | null; agency: string | null; agency_status: string | null; price_list: string | null; price: string; currency: string; commission_pct: string | null; is_credit: boolean; valid_to: string | null; conditions: string | null; restrictions: string | null; diff_pct: number | null }[] | null;
  public_price: { amount: string; currency: string; channel: string } | null;
  promotions: { ref: string; name: string; kind: string; value: string; channel: string | null; promo_code: string | null; min_pax: number | null; date_from: string; date_to: string; status: string; result_price: { amount: string; currency: string } | null }[];
  profitability: { id: string; ref: string; rate_type: string; segment: string; channel: string; currency: string; cost: string; price: string; status: string; margin: string; margin_pct: number | null }[] | null;
  config_groups: { name: string; options: { label: string; price_delta: string }[] }[];
  versions: { version: string; status: string; valid_from: string | null; reason: string | null; created_at: string; author: string | null }[];
  history: { code: string; entity: string; entity_id: string; scope: "producto" | "tarifa" | "salida"; action: string; before_value: string | null; after_value: string | null; occurred_at: string; actor: string | null }[] | null;
  usage: { quotes: { code: string; title: string; status: string; client: string }[]; reservations: { code: string; title: string; status: string; client: string }[] };
}

export const CHECK_STEP: Record<string, number> = { type: 0, name: 0, destination: 2, components: 3, provider: 3, itinerary: 4, rate_today: 5, rate_currency: 5, rate_validity: 5, availability: 7, policies: 8 };
