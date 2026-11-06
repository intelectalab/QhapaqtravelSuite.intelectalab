export interface Money {
  amount: number;
  currency: string;
}

export interface Option {
  value: string;
  label: string;
  count?: number;
}

export interface SiteSede {
  id: string;
  name: string;
  city: string | null;
  address: string;
  phone: string | null;
  is_main: boolean;
}

export interface SiteProfile {
  agency: {
    subdomain: string;
    name: string;
    legal_name: string;
    ruc: string;
    initials: string;
    logo: string | null;
    address: string;
    phone: string | null;
    email: string | null;
    web: string | null;
    registry: string | null;
  };
  branding: { brand: string; accent: string; menu: string };
  sedes: SiteSede[];
  fx: { rate: number; date: string } | null;
  banner: { title: string; body: string } | null;
  policies: { cancel: string | null; modify: string | null; refund: string | null; hold_minutes: number };
  claims_days: number;
}

export interface Rating {
  avg: number;
  count: number;
  verified: boolean;
}

export interface Departure {
  ref: string;
  date: string;
  time: string;
  capacity: number;
  sold: number;
  spots: number;
  guaranteed: boolean;
  meeting_point: string;
  status: string;
  price?: Money | null;
  bookable?: boolean;
  product?: { slug: string; name: string; destination: string };
}

export interface Promotion {
  name: string;
  kind: string;
  value: number;
  percent: boolean;
  code: string | null;
  min_pax: number | null;
  ends_at: string;
}

export interface SeasonTag {
  name: string;
  type?: string;
  factor: number;
  level: "alta" | "media" | "baja" | "especial";
}

export interface ProductCard {
  slug: string;
  name: string;
  summary: string | null;
  type: string;
  kind: string;
  category: string;
  destination: { name: string; slug: string | null };
  duration: string;
  days: number;
  modality: string;
  difficulty: string | null;
  languages: string[];
  rating: Rating | null;
  from: Money | null;
  list: number | null;
  first_date: string | null;
  next_departure: Departure | null;
  daily: boolean;
  featured: boolean;
  tags: { key: string; label: string }[];
  on_date?: { date: string; spots: number | null; season: SeasonTag | null };
  promotion?: Promotion | null;
}

export interface DestinationCard {
  slug: string;
  name: string;
  tagline: string | null;
  altitude: string | null;
  type: string;
  count: number;
  from: Money | null;
}

export interface Review {
  author: string;
  country: string | null;
  date: string;
  stars: number;
  title: string | null;
  body: string | null;
  reply: string | null;
  lang: string;
  source: string;
  verified: boolean;
  product: { name: string; slug: string } | null;
}

export interface ReviewBlock {
  average: number | null;
  count: number;
  verified: number;
  distribution: Record<string, number>;
  items: Review[];
}

export interface HomeData {
  search: { destinations: Option[]; kinds: Option[] };
  destinations: DestinationCard[];
  featured: ProductCard[];
  offers: ProductCard[];
  departures: Departure[];
  reviews: ReviewBlock;
  stats: { products: number; destinations: number; departures: number };
}

export interface DestinationDetail {
  destination: DestinationCard & {
    description: string | null;
    climate: string | null;
    lat: number | null;
    lng: number | null;
    faqs: { q: string; a: string }[];
    region: string;
  };
  months: { month: string; season: { name: string; level: SeasonTag["level"]; factor: number } | null }[];
  special: { name: string; from: string; to: string; factor: number }[];
  products: ProductCard[];
  reviews: ReviewBlock;
}

export interface ListingFacets {
  destinations: Option[];
  kinds: Option[];
  categories: Option[];
  difficulties: Option[];
  languages: Option[];
  modalities: Option[];
  durations: Option[];
  sorts: Option[];
}

export interface ListingData {
  items: ProductCard[];
  total: number;
  destination: { slug: string; name: string } | null;
  facets: ListingFacets;
  fx: number;
}

export interface CalendarDay {
  date: string;
  status: string;
  label: string;
  sellable: boolean;
  price: number | null;
  child: number | null;
  list: number | null;
  currency: string | null;
  season: SeasonTag | null;
  spots: number | null;
  time: string | null;
  note: string | null;
}

export interface CalendarMonth {
  month: string;
  pax: number;
  days: CalendarDay[];
  min: number | null;
  currency: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  items: { time: string | null; activity: string; type: string | null; location: string | null }[];
}

export interface ProductDetail {
  product: ProductCard & {
    description: string | null;
    seo: { title: string; description: string | null };
    pickup: string | null;
    group: { min: number; max: number };
    ages: { min: number; max: number; children: boolean; infants: boolean };
    advance_days: number;
    breadcrumbs: { name: string; slug: string }[];
    promotions: Promotion[];
    media: { url: string; alt: string }[];
  };
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  requirements: { category: string | null; text: string }[];
  policies: Record<string, string>;
  faqs: { q: string; a: string }[];
  departures: Departure[];
  calendar: CalendarMonth[];
  reviews: ReviewBlock;
  related: ProductCard[];
}

export interface QuoteLine {
  key: string;
  label: string;
  qty: number;
  unit: number;
  amount: number;
}

export interface Quote {
  date: string;
  currency: string;
  season: SeasonTag | null;
  lines: QuoteLine[];
  subtotal: number;
  discount: { label: string; amount: number; code: string | null } | null;
  total: number;
  list_total: number | null;
  spots: number | null;
  departure: Departure | null;
  pax: { adults: number; children: number; infants: number };
}

export interface FormOptions {
  sedes: Option[];
  search: { destinations: Option[]; kinds: Option[] };
}

export interface SiteFormState {
  status: "idle" | "error" | "done";
  message?: string;
  errors?: Record<string, string>;
  data?: Record<string, unknown>;
}

export const IDLE: SiteFormState = { status: "idle" };

export const LISTING_KEYS = ["destino", "tipo", "fecha", "viajeros", "duracion", "precio_min", "precio_max", "categoria", "dificultad", "idioma", "modalidad", "orden", "q"] as const;

export type ListingKey = (typeof LISTING_KEYS)[number];

export const SEASON_LABEL: Record<SeasonTag["level"], string> = {
  alta: "Temporada alta",
  media: "Temporada media",
  baja: "Temporada baja",
  especial: "Fecha especial",
};

export const SEASON_TONE: Record<SeasonTag["level"], "t3" | "t1" | "t4" | "t2"> = {
  alta: "t3",
  media: "t1",
  baja: "t4",
  especial: "t2",
};

export const LANGUAGE_LABEL: Record<string, string> = { ES: "Español", EN: "Inglés", DE: "Alemán", FR: "Francés", PT: "Portugués", IT: "Italiano" };

export function siteHref(base: string, path = ""): string {
  const clean = path.startsWith("/") || path === "" ? path : `/${path}`;
  return `${base}${clean}` || "/";
}

export function hueFor(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function listingQuery(params: Partial<Record<ListingKey, string>>): string {
  const query = new URLSearchParams();
  for (const key of LISTING_KEYS) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function pickListing(search: Record<string, string | string[] | undefined>): Partial<Record<ListingKey, string>> {
  const picked: Partial<Record<ListingKey, string>> = {};
  for (const key of LISTING_KEYS) {
    const value = search[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) picked[key] = single;
  }
  return picked;
}

export function daysUntil(iso: string, from = new Date()): number {
  const target = new Date(`${iso}T23:59:59-05:00`).getTime();
  return Math.max(0, Math.ceil((target - from.getTime()) / 86_400_000));
}

export interface CartLine {
  line: number;
  product: { slug: string; name: string };
  date: string;
  pax: { adults: number; children: number; infants: number };
  quote: Omit<Quote, "pax"> | null;
  error: string | null;
  cancellation: string | null;
  hold: { ref: string; status: "hold" | "expirada"; expires_at: string } | null;
}

export interface SiteCart {
  code: string | null;
  promo: string | null;
  items: CartLine[];
  totals: { currency: string; subtotal: number; discount: number; total: number }[];
  hold_minutes: number;
  fx: number;
}

export interface SiteOrder {
  code: string;
  status: string;
  ordered_at: string;
  customer: { name: string; email: string };
  total: number;
  discount: number;
  currency: string;
  hold_expires_at: string | null;
  reservations: {
    code: string;
    status: string;
    title: string;
    date: string;
    total: number;
    currency: string;
    services: { name: string; date: string; time: string | null; pax: number; status: string; confirmation: string | null }[];
    receivables: { code: string; concept: string; amount: number; paid: number; currency: string; status: string; due_date: string }[];
  }[];
}

export function cartCookie(agencia: string): string {
  return `qhapaq_cart_${agencia}`;
}

export function orderCookie(code: string): string {
  return `qhapaq_order_${code}`;
}
