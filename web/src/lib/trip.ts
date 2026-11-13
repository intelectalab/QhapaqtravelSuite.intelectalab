import type { Tone } from "@/lib/tone";

export type InTripKind = "tour" | "transport";

export interface InTripItem {
  kind: InTripKind;
  item_id: string;
  uuid: string;
  name: string;
  city: string;
  from_city: string | null;
  mode: string | null;
  mode_label: string | null;
  date: string;
  time: string | null;
  currency: string;
  amount: string;
  adults: number;
  children: number;
  vehicle: string | null;
  units: number | null;
}

export interface InTripOffer {
  id: string;
  code: string;
  kind: "tour" | "transporte";
  item_id: string | null;
  name: string | null;
  service_date: string;
  currency: string;
  amount: string;
  status: InTripStatus;
  status_label: string;
  channel: string;
  expires_at: string;
  payment_link: { code: string; url: string | null; status: string | null } | null;
  created_by: string | null;
  created_at: string;
  cancellable: boolean;
}

export type InTripStatus = "ofrecida" | "link_enviado" | "pagada" | "confirmada" | "vencida" | "cancelada" | "reembolsada";

export const OFFER_TONES: Record<InTripStatus, Tone> = {
  ofrecida: "t1",
  link_enviado: "t2",
  pagada: "ok",
  confirmada: "ok",
  vencida: "mute",
  cancelada: "mute",
  reembolsada: "warn",
};

export interface InTripAvailable {
  reservation: { code: string; title: string; status: string };
  enabled: boolean;
  reason: string | null;
  min_hours_before: number;
  currency: string;
  items: InTripItem[];
  offers: InTripOffer[];
}

export interface TripSeasonRate {
  id: string;
  hotel_id: string;
  label: string;
  date_from: string;
  date_to: string;
  adjust_pct: string;
}

export interface TripTour {
  id: string;
  code: string;
  leg_id: string;
  city: string | null;
  name: string;
  day_offset: number;
  start_time: string;
  duration_hours: string;
  currency: string;
  price_adult: string;
  price_child: string;
  min_age: number | null;
  capacity: number | null;
  provider: { id: string; name: string | null } | null;
  in_trip_sale: boolean;
  active: boolean;
}

export interface TripOption {
  id: string;
  code: string;
  from_leg_id: string;
  to_leg_id: string | null;
  from_city: string | null;
  to_city: string | null;
  scope: "local" | "entre_ciudades";
  mode: string;
  mode_label: string;
  name: string;
  pricing: "pax" | "vehiculo";
  currency: string;
  price_adult: string | null;
  price_child: string | null;
  duration_hours: string | null;
  provider: { id: string; name: string | null } | null;
  in_trip_sale: boolean;
  active: boolean;
  vehicles: { id: string; name: string; max_pax: number; price: string }[];
}

export interface TripCatalogView {
  product: { id: string; code: string; name: string; status: string; lock_version: number };
  rules: { trip_builder: { on: boolean; tenant_on: boolean; plan_allows: boolean }; in_trip_sales: { on: boolean; min_hours_before: number } };
  accommodation_enabled: boolean;
  legs: {
    id: string;
    code: string;
    sequence: number;
    city: string;
    nights: number;
    min_nights: number | null;
    max_nights: number | null;
    hotels: { id: string; code: string; name: string; category: string | null; season_rates: TripSeasonRate[] }[];
    tours: TripTour[];
  }[];
  transport: TripOption[];
  summary: { legs: number; flexible_legs: number; season_rates: number; tours: number; tours_in_trip: number; transport: number };
  options: { modes: { value: string; label: string }[]; pricing: { value: string; label: string }[]; providers: { id: string; name: string; type: string }[] };
  can: { update: boolean };
}

export interface ReservationTripView {
  reservation: { code: string; title: string; status: string; currency: string; travel_from: string; travel_to: string };
  product: { id: string; code: string; name: string } | null;
  rules: { trip_builder: boolean; in_trip_sales: boolean; min_hours_before: number };
  pax: { adt: number; chd: number; inf: number };
  legs: { id: string; sequence: number; city: string; nights: number; check_in: string; check_out: string; items: ReservationTripItem[] }[];
  items: ReservationTripItem[];
  trip_end: string | null;
  by_category: { currency: string; total: string; categories: Record<"base" | "lodging" | "tour" | "transport" | "addon" | "surcharge", string> };
  offers: InTripOffer[];
  available: InTripAvailable | null;
}

export interface ReservationTripItem {
  id: string;
  kind: InTripKind;
  code: string | null;
  name: string | null;
  mode: string | null;
  service_date: string;
  start_time: string | null;
  adults: number;
  children: number;
  vehicle: { name: string; units: number } | null;
  currency: string;
  amount: string;
  sold_in_trip: boolean;
  service: { code: string; status: string; provider: string | null } | null;
}

export const TRIP_CATEGORIES: { key: "base" | "lodging" | "tour" | "transport" | "addon" | "surcharge"; label: string; tone: Tone }[] = [
  { key: "base", label: "Tour base", tone: "t1" },
  { key: "lodging", label: "Alojamiento", tone: "t2" },
  { key: "tour", label: "Tours", tone: "t3" },
  { key: "transport", label: "Movilidad", tone: "t4" },
  { key: "addon", label: "Adicionales", tone: "ok" },
  { key: "surcharge", label: "Recargos", tone: "warn" },
];
