export type BookingSectionStatus = "on" | "product_off" | "tenant_off";

export type BookingSectionId = "disponibilidad" | "pasajeros" | "adicionales" | "alojamiento" | "pago" | "recojo";

export interface PaxRulesValues {
  adult_min_age: number;
  child_min_age: number;
  child_max_age: number;
  infant_max_age: number;
  child_pays: boolean;
  child_price_pct: string;
  infant_allowed: boolean;
  infant_pays: boolean;
  max_children_per_adult: number;
  max_infants_per_adult: number;
  min_adults: number;
  note?: string | null;
}

export interface BookingAddon {
  id: string;
  code: string;
  name: string;
  category: string;
  price: string;
  currency: string;
  charge_per: "pax" | "reserva";
  applies_to: string[];
  stock_note: string | null;
  is_optional: boolean;
  provider: { id: string; name: string | null } | null;
  service: { id: string; ref: string; name: string } | null;
}

export interface RoomType {
  room_type: string;
  capacity: number;
  price_per_night: string;
}

export interface AccommodationHotel {
  id: string;
  code: string;
  name: string;
  category: string;
  provider: { id: string; name: string | null } | null;
  room_types: RoomType[];
}

export interface AccommodationLeg {
  id: string;
  code: string;
  sequence: number;
  city: string;
  destination: { id: string; name: string | null } | null;
  nights: number;
  hotels: AccommodationHotel[];
}

export interface RuleParam {
  key: string;
  label: string;
  type: "number" | "bool" | "choice";
  value: number | boolean | string;
  unit: string | null;
  min: number | null;
  max: number | null;
  options: { value: string; label: string }[] | null;
}

export interface ProductRuleState {
  code: string;
  group: string;
  name: string;
  description: string;
  product_override: boolean;
  tenant_enabled: boolean;
  product_disabled: boolean;
  effective: boolean;
  has_override: boolean;
  params: RuleParam[];
  tenant_params: Record<string, unknown>;
  own_params: Record<string, unknown>;
}

export interface QuotePreviewLine {
  key: string;
  kind: string;
  label: string;
  qty: number;
  unit: string;
  amount: string;
}

export interface PaymentExample {
  mode: string;
  date: string;
  total: string;
  deposit_pct: number;
  deposit: string;
  balance: string;
  balance_due: string | null;
  hold_hours: number | null;
  currency: string;
}

export interface PaxSimulation {
  ok: boolean;
  errors: string[];
  seats: number;
  ages: { age: number; type: "ADT" | "CHD" | "INF" | "NA" }[];
  lines: QuotePreviewLine[];
  subtotal: string;
  currency: string;
  warnings: string[];
}

export interface ProductBookingConfig {
  product: { id: string; code: string; name: string; status: string; lock_version: number; duration: number | null };
  sections: Record<BookingSectionId, { rules: string[]; status: BookingSectionStatus }>;
  operation: { operating_weekdays: number[]; cutoff_hours: number | null; advance_min_days: number };
  pax_rules: { inherited: boolean; values: PaxRulesValues | null; effective: PaxRulesValues; warnings: string[] };
  addons: BookingAddon[];
  accommodation: { enabled: boolean; optional: boolean; currency: string | null; note: string | null; legs: AccommodationLeg[]; cities: number; nights: number; expected_nights: number | null; warnings: string[] };
  payment: {
    inherited: boolean;
    values: { modes: string[]; deposit_pct: number | null; balance_due_days: number | null; note: string | null } | null;
    tenant: { deposit_pct: number; balance_due_days: number; hold_hours: number };
    pay_later: { tenant_enabled: boolean; enabled: boolean };
    effective_modes: string[];
  };
  pickup: { required: boolean; ask_flight: boolean; points: { id: string; sequence: number; label: string; kind: string; requires_address: boolean }[] };
  rules: ProductRuleState[];
  summary: { ranges: number; pax: string; addons: number; lodging: { cities: number; nights: number } | null; payment: string[]; pickup_points: number; overrides: number };
  options: {
    currencies: string[];
    addon_categories: string[];
    pax_types: { value: string; label: string }[];
    room_types: string[];
    hotel_categories: string[];
    pickup_kinds: { value: string; label: string }[];
    providers: { id: string; name: string; type: string }[];
    services: { id: string; ref: string; name: string; provider_id: string; type: string }[];
    destinations: { id: string; name: string }[];
  };
  can: { update: boolean; manage_rates: boolean; manage_availability: boolean; manage_pickup: boolean; admin_rules: boolean };
  examples: {
    lodging: { pax: number; rooms: number; nights: number; currency: string; total: string; lines: QuotePreviewLine[]; warnings: string[] } | null;
    payment: PaymentExample[];
  };
}

export const WEEKDAYS = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
  { value: "0", label: "Dom" },
];

export const PAYMENT_MODE_LABEL: Record<string, string> = { total: "Pago total", adelanto: "Adelanto", pagar_despues: "Pagar después" };

export const PAX_TYPE_LABEL: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante", NA: "Sin banda" };

export const CHARGE_LABEL: Record<string, string> = { pax: "por pasajero", reserva: "por reserva" };

export const BOOKING_SECTION_RULE_NOTE: Record<BookingSectionStatus, string | null> = {
  on: null,
  product_off: "Desactivada solo para este producto. La configuración se conserva.",
  tenant_off: "Regla desactivada para esta agencia. La configuración se conserva y vuelve a aplicarse si se activa.",
};
